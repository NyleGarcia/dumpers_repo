import React from 'react'
import { Link } from '@tanstack/react-router'
import type { UserNotification } from '../lib/operations'
import { getNotificationActionLink } from '../lib/notificationLinks'

interface NotificationBodyProps {
  notification: UserNotification
  onNavigate?: () => void
}

export default function NotificationBody({ notification, onNavigate }: NotificationBodyProps) {
  const link = getNotificationActionLink(notification)

  if (!notification.body && !link) return null

  return (
    <p className="text-xs mt-0.5 text-slate-400 leading-relaxed">
      {notification.body}
      {notification.body && link ? ' ' : null}
      {link && (
        <Link
          to={link.to}
          onClick={onNavigate}
          className="text-cyan-400 hover:text-cyan-300 underline font-medium"
        >
          {link.label}
        </Link>
      )}
    </p>
  )
}
