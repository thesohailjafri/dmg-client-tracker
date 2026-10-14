"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cn } from "cn"
import { CircleAlertIcon, CircleCheckIcon, XIcon } from "lucide-react"

// One manager for the whole app, so anything can raise a toast, in a component or out of one:
//   toast.add({ type: "success", title: "Changes saved" })
// The Toaster sits in the root layout, so a toast raised just before a page change is still
// there on the next page.
const toast = ToastPrimitive.createToastManager()

function Toaster() {
  return (
    <ToastPrimitive.Provider toastManager={toast} timeout={4000} limit={3}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          className="fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] flex-col gap-2 outline-none sm:w-88"
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((item) => (
    <ToastPrimitive.Root
      key={item.id}
      toast={item}
      data-slot="toast"
      className={cn(
        "flex items-start gap-2.5 rounded-xl bg-popover p-3 pr-2 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-[opacity,translate] duration-200 select-none",
        "data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:translate-y-2 data-ending-style:opacity-0",
        // over the limit: out of sight until the ones in front of it go
        "data-limited:hidden"
      )}
    >
      {item.type === "error" ? (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      ) : (
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ToastPrimitive.Title className="leading-5 font-medium" />
        <ToastPrimitive.Description className="text-xs text-muted-foreground" />
      </div>
      <ToastPrimitive.Close
        aria-label="Dismiss"
        className="-mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <XIcon className="size-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ))
}

export { toast, Toaster }
