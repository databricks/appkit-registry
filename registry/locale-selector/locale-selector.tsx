import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@databricks/appkit-ui/react";
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

/** The locale's name in its own language, or the code if it can't be named. */
function localeLabel(locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
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
            {localeLabel(locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
