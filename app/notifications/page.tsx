"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import {
  Bell,
  CheckCheck,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
} from "lucide-react"

const notifications = [
  {
    id: "1",
    type: "deadline",
    message: "Application deadline for 'Software Engineer - Google' is in 5 days",
    is_read: false,
    created_at: "2024-11-08T10:30:00",
  },
  {
    id: "2",
    type: "status_update",
    message: "Application 'Product Designer - Meta' status changed to Interview",
    is_read: false,
    created_at: "2024-11-08T09:15:00",
  },
  {
    id: "3",
    type: "success",
    message: "Document 'Resume_2024.pdf' was successfully analyzed",
    is_read: true,
    created_at: "2024-11-07T14:20:00",
  },
  {
    id: "4",
    type: "info",
    message: "New AI-generated answers are ready for your review",
    is_read: true,
    created_at: "2024-11-07T11:00:00",
  },
  {
    id: "5",
    type: "warning",
    message: "You have 3 applications in draft status. Complete them soon!",
    is_read: true,
    created_at: "2024-11-06T16:45:00",
  },
]

const typeConfig = {
  deadline: { icon: Calendar, color: "text-red-500", bg: "bg-red-500/10" },
  status_update: { icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
  success: { icon: CheckCheck, color: "text-green-500", bg: "bg-green-500/10" },
  info: { icon: Bell, color: "text-blue-500", bg: "bg-blue-500/10" },
  warning: { icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
}

export default function NotificationsPage() {
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
          <Button variant="outline">
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark All as Read
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          {notifications.map((notification, index) => {
            const config = typeConfig[notification.type as keyof typeof typeConfig]
            const Icon = config.icon

            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card
                  className={`hover:border-primary/40 transition-all cursor-pointer ${
                    !notification.is_read ? "border-primary/20" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className={`h-10 w-10 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <p className={`font-medium ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                            {notification.message}
                          </p>
                          {!notification.is_read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0 ml-2 mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {notifications.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-muted-foreground">
                You're all caught up! New notifications will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
