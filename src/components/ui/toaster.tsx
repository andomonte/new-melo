import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="custom-toast">
            <div className="grid gap-1">
              {title && <ToastTitle className="custom-toast-title">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="custom-toast-description">{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="custom-toast-close" />
          </Toast>
        )
      })}
      <ToastViewport className="custom-toast-viewport" />
    </ToastProvider>
  )
}