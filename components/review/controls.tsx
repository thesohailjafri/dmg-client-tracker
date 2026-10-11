import { Label } from "@/components/ui/label";

// Label, the control, then help text (id `${htmlFor}-help`).
export function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {help && (
        <p id={`${htmlFor}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}

// Pick-one row of chips. `swatch` puts a colour dot in front of the label.
export function Choices<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: readonly { value: T; label: string; swatch?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <div className="text-sm leading-none font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Label
            key={option.value}
            className="h-8 rounded-lg border border-input px-3 font-normal has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium has-checked:text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.swatch && (
              <span
                aria-hidden="true"
                className="size-3 rounded-full ring-1 ring-foreground/15"
                style={{ backgroundColor: option.swatch }}
              />
            )}
            {option.label}
          </Label>
        ))}
      </div>
    </div>
  );
}
