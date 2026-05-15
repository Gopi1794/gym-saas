import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime, getInitials } from "@/lib/utils"

interface CheckInRow {
  id: string
  checked_in_at: string
  method: string
  profiles: {
    full_name: string | null
    avatar_url: string | null
    membership_type: string | null
  } | null
}

export default function CheckInLog({ checkIns }: { checkIns: CheckInRow[] }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="font-heading text-xl font-normal tracking-wide text-card-foreground">
          Today&apos;s Check-ins
          <span className="ml-2 font-sans text-sm font-normal tracking-normal text-muted-foreground">
            ({checkIns.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {checkIns.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            No check-ins yet today
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {checkIns.map((ci) => (
              <li key={ci.id} className="flex items-center gap-4 px-6 py-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={ci.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                    {getInitials(ci.profiles?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-card-foreground">
                    {ci.profiles?.full_name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(ci.checked_in_at)} ·{" "}
                    {ci.method === "qr" ? "QR scan" : "Manual"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-brand/30 bg-brand-950/30 text-brand-200 capitalize"
                >
                  {ci.profiles?.membership_type ?? "basic"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
