import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { buildSlashSuggestion } from "../components/slash-menu";

export const SlashExtension = Extension.create<{
  onOpenCitationPicker: () => void;
}>({
  name: "slash",

  addOptions() {
    return {
      onOpenCitationPicker: () => {},
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        ...buildSlashSuggestion(this.options.onOpenCitationPicker),
      }),
    ];
  },
});
