# Locale Selector

A language picker built on AppKit UI `Select`. Each option shows the locale's name in its own language (via `Intl.DisplayNames`, no extra dependency). A code the browser can't name is shown as-is.

## Usage

```tsx
import { useState } from "react";
import { LocaleSelector } from "@/components/appkit/locale-selector";

export function Header() {
  const [locale, setLocale] = useState("en");
  return (
    <LocaleSelector
      locales={["en", "es", "fr", "ja"]}
      value={locale}
      onValueChange={setLocale}
    />
  );
}
```

### With the `general-translation` plugin

Read the supported locales from the plugin's client config, and start from the locale the server detects for the visitor:

```tsx
import { useEffect, useState } from "react";
import { usePluginClientConfig } from "@databricks/appkit-ui/react";
import { LocaleSelector } from "@/components/appkit/locale-selector";

interface GtClientConfig {
  defaultLocale: string;
  locales: string[];
}

export function Header() {
  const { defaultLocale, locales } = usePluginClientConfig<GtClientConfig>("gt");
  const [locale, setLocale] = useState(defaultLocale);

  useEffect(() => {
    fetch("/api/gt/locale")
      .then((res) => res.json())
      .then((data: { locale: string }) => setLocale(data.locale));
  }, []);

  return (
    <LocaleSelector locales={locales} value={locale} onValueChange={setLocale} />
  );
}
```

## Props

| Prop            | Type                       | Description                                   |
| --------------- | -------------------------- | --------------------------------------------- |
| `locales`       | `string[]`                 | BCP 47 locale codes to offer.                 |
| `value`         | `string`                   | The selected locale.                          |
| `onValueChange` | `(locale: string) => void` | Called when the user picks a locale.          |
| `label`         | `string`                   | Accessible label. Defaults to `"Language"`.   |
| `className`     | `string`                   | Extra classes for the trigger.                |
