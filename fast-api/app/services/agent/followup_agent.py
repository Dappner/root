"""Small Jetflow agent for post-answer follow-up chips."""

from jetflow import AsyncAgent, action
from pydantic import BaseModel, Field, ValidationError

from app.providers.llm import create_llm_client
from app.schemas.rag import ModelConfig

MAX_CONTEXT_CHARS = 5000

FOLLOWUP_SYSTEM_PROMPT = """You generate follow-up prompt chips for a source reflection chat.

Return 2-4 short prompts as your final action.
Make each prompt specific to the user's question, the assistant answer, and the retrieved context.
Each prompt must fit on a compact UI chip.
Do not include citations, markdown, numbering, or generic filler.
"""


class FollowUpPrompts(BaseModel):
    """Final follow-up chip labels."""

    prompts: list[str] = Field(
        min_length=2,
        max_length=4,
        description="Short personalized follow-up prompt labels.",
    )


@action(schema=FollowUpPrompts, exit=True)
def finish_followups(payload: FollowUpPrompts) -> str:
    """Return follow-up prompts as JSON."""
    return payload.model_dump_json()


async def generate_followups(
    *,
    user_question: str,
    answer: str,
    context: str,
) -> list[str]:
    """Generate personalized follow-up prompts using a small Jetflow agent."""
    client = create_llm_client(
        ModelConfig(
            provider="gemini",
            model="gemini-3.5-flash-lite",
            thinking_level="minimal",
        )
    )
    agent = AsyncAgent(
        client=client,
        actions=[finish_followups],
        system_prompt=FOLLOWUP_SYSTEM_PROMPT,
        require_action=True,
        max_iter=1,
        verbose=False,
    )

    response = await agent.run(
        "User question:\n"
        f"{user_question}\n\n"
        "Assistant answer:\n"
        f"{answer}\n\n"
        "Retrieved context:\n"
        f"{context[:MAX_CONTEXT_CHARS]}"
    )
    # After an exit action the run ends on the tool message, so jetflow leaves
    # `.parsed` unset and `.content` holds the action's return value (the JSON from
    # finish_followups), same as transcript sectioning reads it. Follow-up chips
    # are non-critical, so fall back to no chips rather than raising.
    try:
        parsed = FollowUpPrompts.model_validate_json(response.content or "")
    except ValidationError:
        return []
    return [prompt.strip() for prompt in parsed.prompts if prompt.strip()][:4]
