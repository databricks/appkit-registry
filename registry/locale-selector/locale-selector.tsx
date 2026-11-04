import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@databricks/appkit-ui/react";
import { getLocaleProperties } from "generaltranslation";
import { LanguagesIcon } from "lucide-react";

export interface LocaleSelectorProps {
  /** BCP 47 locale codes to offer, e.g. ["en", "es", "ja"]. */
  locales: string[];
  /** The selected locale. */
  value: string;
  /** Called with the new locale code when the user picks one. */
  onValueChange: (locale: string) => void;
  /** Accessible label for the trigger. */
  label?: string;
  className?: string;
}

/**
 * A language picker built on AppKit UI Select. Each option shows the locale's
 * name in its own language (e.g. "español", "日本語").
 */
export function LocaleSelector({
  locales,
  value,
  onValueChange,
  label = "Language",
  className,
}: LocaleSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className={cn("w-fit gap-2", className)}>
        <LanguagesIcon className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {getLocaleProperties(locale).nativeName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
