"use client";

import React, { useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";

export interface CountryOption {
  id: string;
  name: string;
  code: string;
  flagEmoji?: string;
  flagSvg?: React.ReactNode;
}

export const COUNTRIES: CountryOption[] = [
  { id: "ro", name: "România", code: "RO", flagEmoji: "🇷🇴" },
  { id: "de", name: "Germania", code: "DE", flagEmoji: "🇩🇪" },
  { id: "fr", name: "Franța", code: "FR", flagEmoji: "🇫🇷" },
  { id: "it", name: "Italia", code: "IT", flagEmoji: "🇮🇹" },
  { id: "es", name: "Spania", code: "ES", flagEmoji: "🇪🇸" },
  { id: "cz", name: "Cehia", code: "CZ", flagEmoji: "🇨🇿" },
  { id: "hu", name: "Ungaria", code: "HU", flagEmoji: "🇭🇺" },
  { id: "pl", name: "Polonia", code: "PL", flagEmoji: "🇵🇱" },
  { id: "gr", name: "Grecia", code: "GR", flagEmoji: "🇬🇷" },
  { id: "bg", name: "Bulgaria", code: "BG", flagEmoji: "🇧🇬" },
  { id: "hr", name: "Croația", code: "HR", flagEmoji: "🇭🇷" },
  { id: "rs", name: "Serbia", code: "RS", flagEmoji: "🇷🇸" },
  { id: "si", name: "Slovenia", code: "SI", flagEmoji: "🇸🇮" },
  { id: "sk", name: "Slovacia", code: "SK", flagEmoji: "🇸🇰" }
];

export interface CountrySelectProps {
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  className?: string;
  label?: string;
}

export function CountrySelect({
  defaultSelectedKey = "ro",
  onSelectionChange,
  className = "w-[240px]",
  label = "Piață / Țară"
}: CountrySelectProps) {
  const [selected, setSelected] = useState<string>(defaultSelectedKey);

  const handleSelection = (key: string) => {
    setSelected(key);
    if (onSelectionChange) {
      onSelectionChange(key);
    }
  };

  const currentCountry = COUNTRIES.find((c) => c.id === selected) || COUNTRIES[0];

  return (
    <Select
      className={className}
      placeholder="Selectează o țară"
      selectedKeys={[selected]}
    >
      {label && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value>
          <span className="inline-flex items-center gap-2">
            <span className="text-base">{currentCountry.flagEmoji}</span>
            <span>{currentCountry.name}</span>
          </span>
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox
          aria-label="Alege țara"
          onAction={(key) => handleSelection(String(key))}
        >
          {COUNTRIES.map((country) => (
            <ListBox.Item
              key={country.id}
              id={country.id}
              textValue={country.name}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{country.flagEmoji}</span>
                <span>{country.name}</span>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export default CountrySelect;
