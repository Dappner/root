"""Heavy client initialization.

Imported only by app/main.py and app/deps.py.
All clients are initialized once at startup before the app begins serving requests.
"""

from app.core.config import settings
from app.integrations.apple_podcasts import ApplePodcastsClient
from app.integrations.assemblyai import AssemblyAIClient
from app.integrations.elevenlabs import ElevenLabsClient
from app.integrations.r2 import R2Client
from app.integrations.youtube import YouTubeTranscriptClient
from app.providers.embedder import create_embedder

r2 = R2Client()
embedder = create_embedder(settings)
assemblyai = AssemblyAIClient(api_key=settings.assemblyai_api_key)
elevenlabs = ElevenLabsClient(
    api_key=settings.elevenlabs_api_key,
    agent_id=settings.elevenlabs_agent_id,
)
youtube = YouTubeTranscriptClient(
    proxy_username=settings.youtube_proxy_username,
    proxy_password=settings.youtube_proxy_password,
    proxy_country=settings.youtube_proxy_country,
)
apple_podcasts = ApplePodcastsClient()
