'use client';

import React from 'react';
import { trackEvent, type AnalyticsEventParams } from '@/lib/analytics';

export interface TrackedOutboundLinkProps {
  href: string;
  eventName: string;
  eventParams?: AnalyticsEventParams;
  rel?: string;
  target?: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

export function TrackedOutboundLink({
  href,
  eventName,
  eventParams,
  rel = 'nofollow noopener noreferrer',
  target = '_blank',
  className,
  ariaLabel,
  children,
}: TrackedOutboundLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      className={className}
      onClick={() => trackEvent(eventName, eventParams)}
    >
      {children}
    </a>
  );
}
