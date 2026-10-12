import { Briefcase, ClipboardCheck, FileText, Home, Search, ShieldCheck, User } from 'lucide-react';

export const ROLE_LABELS = { student: 'Student', recruiter: 'Recruiter', admin: 'Placement Officer' };

// One place to define navigation per role; later milestones append their links here.
export const NAV = {
  student: [
    { to: '/student', label: 'Home', icon: Home, end: true },
    { to: '/student/internships', label: 'Internships', icon: Search },
  ],
  recruiter: [
    { to: '/recruiter', label: 'Home', icon: Home, end: true },
    { to: '/recruiter/listings', label: 'My listings', icon: Briefcase },
  ],
  admin: [
    { to: '/admin', label: 'Home', icon: Home, end: true },
    { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck },
  ],
};

export const ICONS = { ClipboardCheck, FileText, User };
