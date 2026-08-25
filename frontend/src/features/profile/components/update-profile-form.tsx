"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateUser } from "@/lib/auth/client";
import { useRouter } from "@/lib/nav";

const UpdateProfileFormSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255),
});

type UpdateProfileFormData = z.infer<typeof UpdateProfileFormSchema>;

interface UpdateProfileFormProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function UpdateProfileForm({ user }: UpdateProfileFormProps) {
  const router = useRouter();

  const form = useForm<UpdateProfileFormData>({
    resolver: zodResolver(UpdateProfileFormSchema),
    defaultValues: {
      name: user.name || "",
    },
  });

  async function onSubmit(data: UpdateProfileFormData) {
    if (data.name === user.name) {
      toast.error("No changes to save");
      return;
    }

    try {
      const result = await updateUser({
        name: data.name.trim(),
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to update profile");
      } else {
        toast.success("Profile updated successfully");
        router.refresh();
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    }
  }

  return (
    <form
      id="update-profile-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
    >
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <div className="flex gap-2">
                <Input
                  {...field}
                  id="name"
                  type="text"
                  aria-invalid={fieldState.invalid}
                  autoComplete="name"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={
                    form.formState.isSubmitting || field.value === user.name
                  }
                  form="update-profile-form"
                >
                  {form.formState.isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}
