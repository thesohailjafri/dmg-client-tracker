"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react"
import * as RPNInput from "react-phone-number-input"
import flags from "react-phone-number-input/flags"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// After github.com/omeralpi/shadcn-phone-input, rebuilt on Base UI: a country picker joined to
// a number field. The value is always "+<country><number>", or "" while there is no number.

type PhoneInputProps = Omit<
  React.ComponentProps<"input">,
  "onChange" | "value" | "ref"
> &
  Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & {
    onChange?: (value: RPNInput.Value) => void
  }

function PhoneInput({ className, onChange, value, ...props }: PhoneInputProps) {
  return (
    <RPNInput.default
      className={cn("flex", className)}
      flagComponent={FlagComponent}
      countrySelectComponent={CountrySelect}
      inputComponent={NumberInput}
      smartCaret={false}
      value={value || undefined}
      // the library reports "no number yet" as undefined
      onChange={(next) => onChange?.(next || ("" as RPNInput.Value))}
      {...props}
    />
  )
}

function NumberInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      className={cn("rounded-s-none focus-visible:z-10", className)}
      {...props}
    />
  )
}

type CountryEntry = { label: string; value: RPNInput.Country | undefined }

type CountrySelectProps = {
  disabled?: boolean
  value: RPNInput.Country | undefined
  options: CountryEntry[]
  onChange: (country: RPNInput.Country) => void
}

function CountrySelect({
  disabled,
  value: selected,
  options,
  onChange,
}: CountrySelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const search = React.useRef<HTMLInputElement>(null)
  const list = React.useRef<HTMLDivElement>(null)

  // by name, dialling code ("+91" or "91") or two-letter code
  const needle = query.trim().toLowerCase()
  const countries = options.flatMap(({ value, label }) => {
    if (!value) return []
    const code = RPNInput.getCountryCallingCode(value)
    const matches =
      !needle ||
      label.toLowerCase().includes(needle) ||
      `+${code}`.startsWith(needle) ||
      code.startsWith(needle) ||
      value.toLowerCase() === needle
    return matches ? [{ value, label, code }] : []
  })
  const selectedName = options.find((option) => option.value === selected)?.label

  function pick(country: RPNInput.Country) {
    onChange(country)
    setOpen(false)
  }

  // Arrow keys walk the list, and step back up into the search box from its first row.
  function walk(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    const rows = Array.from(list.current?.querySelectorAll("button") ?? [])
    if (rows.length === 0) return
    event.preventDefault()
    const index = rows.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === "ArrowDown" ? index + 1 : index - 1
    if (next < 0) search.current?.focus()
    else rows[Math.min(next, rows.length - 1)].focus()
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setQuery("")
      }}
    >
      <PopoverPrimitive.Trigger
        disabled={disabled}
        aria-label={selectedName ? `Country: ${selectedName}` : "Pick a country"}
        render={
          <Button
            type="button"
            variant="outline"
            className="gap-1 rounded-e-none border-r-0 border-input px-2.5 focus-visible:z-10"
          />
        }
      >
        <FlagComponent country={selected} countryName={selectedName ?? ""} />
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="isolate z-50 outline-none"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <PopoverPrimitive.Popup
            data-slot="phone-input-countries"
            className="w-72 max-w-(--available-width) rounded-lg bg-popover text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"
            onKeyDown={walk}
          >
            <div className="relative border-b p-1.5">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={search}
                type="search"
                aria-label="Search countries"
                placeholder="Search country..."
                autoComplete="off"
                className="pl-8"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  if (list.current) list.current.scrollTop = 0
                }}
                onKeyDown={(event) => {
                  // Enter takes the top match
                  if (event.key !== "Enter") return
                  event.preventDefault()
                  if (countries.length > 0) pick(countries[0].value)
                }}
              />
            </div>
            <div ref={list} className="max-h-64 overflow-y-auto p-1">
              {countries.length === 0 && (
                <p className="px-2 py-6 text-center text-muted-foreground">
                  No country found.
                </p>
              )}
              {countries.map((country) => (
                <button
                  key={country.value}
                  type="button"
                  aria-pressed={country.value === selected}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                  onClick={() => pick(country.value)}
                >
                  <FlagComponent
                    country={country.value}
                    countryName={country.label}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {country.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    +{country.code}
                  </span>
                  <CheckIcon
                    className={cn(
                      "size-4",
                      country.value !== selected && "invisible"
                    )}
                  />
                </button>
              ))}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function FlagComponent({
  country,
  countryName,
}: {
  country: RPNInput.Country | undefined
  countryName: string
}) {
  const Flag = country ? flags[country] : undefined
  return (
    // decoration: the country is always named in text or in a label beside it
    <span
      aria-hidden="true"
      className="flex h-4 w-6 shrink-0 overflow-hidden rounded-sm bg-foreground/20 [&_svg]:size-full!"
    >
      {Flag && <Flag title={countryName} />}
    </span>
  )
}

export { PhoneInput }
