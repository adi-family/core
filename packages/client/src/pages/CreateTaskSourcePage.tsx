import { TaskSourceMultistageForm } from "@/components/TaskSourceMultistageForm"
import { designTokens } from "@/theme/tokens"

export function CreateTaskSourcePage() {
  return (
    <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
      <TaskSourceMultistageForm />
    </div>
  )
}
