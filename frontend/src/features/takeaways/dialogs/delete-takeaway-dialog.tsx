"use client";

import { BaseDialogProps } from "@/components/dialogs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteTakeaway } from "@/features/takeaways/hooks";
import { routes } from "@/lib/routes";
import { useRouter } from "@/lib/nav";
import { toast } from "sonner";

interface DeleteTakeawayDialogProps extends BaseDialogProps {
  sourceId: number;
  takeawayId: number;
  takeawayTitle: string;
}

export function DeleteTakeawayDialog({
  open,
  onOpenChange,
  sourceId,
  takeawayId,
  takeawayTitle,
}: DeleteTakeawayDialogProps) {
  const deleteMutation = useDeleteTakeaway();
  const router = useRouter();

  const onDelete = async () => {
    try {
      await deleteMutation.mutateAsync({
        sourceId,
        takeawayId,
      });
      toast.success("Takeaway deleted");
      onOpenChange(false);
      router.push(routes.source(sourceId));
    } catch (error) {
      console.error("Failed to delete takeaway:", error);
      toast.error("Failed to delete takeaway");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete takeaway?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &quot;{takeawayTitle}&quot;. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
