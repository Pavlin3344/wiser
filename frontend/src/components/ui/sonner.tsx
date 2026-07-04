import { useUIStore } from "@/store/use-ui-store"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useUIStore()


  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-emerald-500" />
        ),
        info: (
          <InfoIcon className="size-4 text-sky-500" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-orange-500" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-red-500" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      style={
        {
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast backdrop-blur-xl shadow-lg border border-white/10 border-t-white/20 border-l-white/20 rounded-2xl flex items-center gap-3 p-4 bg-background/60 text-foreground",
          success: "!bg-emerald-500/10 !text-emerald-500 !border-emerald-500/30",
          info: "!bg-sky-500/10 !text-sky-500 !border-sky-500/30",
          warning: "!bg-orange-500/10 !text-orange-500 !border-orange-500/30",
          error: "!bg-red-500/10 !text-red-500 !border-red-500/30",
          default: "!bg-background/60 !text-foreground !border-white/10",
          title: "text-xs font-semibold font-sans",
          description: "text-[11px] text-muted-foreground font-sans",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
