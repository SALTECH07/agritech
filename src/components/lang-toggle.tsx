import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "sw" ? "en" : "sw")}
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      <span className="ml-1 text-xs font-bold uppercase">{lang}</span>
    </Button>
  );
}
