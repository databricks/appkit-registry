# Locale Selector

A language picker built on AppKit UI `Select`. Each option shows the locale's name in its own language (via `Intl.DisplayNames`, no extra dependency).

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

Pairs with the `general-translation` server plugin: pass the `locales` from its client config, and the detected locale from `GET /api/gt/locale`.

## Props

| Prop            | Type                       | Description                                   |
| --------------- | -------------------------- | --------------------------------------------- |
| `locales`       | `string[]`                 | BCP 47 locale codes to offer.                 |
| `value`         | `string`                   | The selected locale.                          |
| `onValueChange` | `(locale: string) => void` | Called when the user picks a locale.          |
| `label`         | `string`                   | Accessible label. Defaults to `"Language"`.   |
| `className`     | `string`                   | Extra classes for the trigger.                |
