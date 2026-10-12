import { Briefcase, ClipboardCheck, FileQuestion, FileText, Home, ListChecks, Search, ShieldCheck, Timer, User } from 'lucide-react';

export const ROLE_LABELS = { student: 'Student', recruiter: 'Recruiter', admin: 'Placement Officer' };

// One place to define navigation per role; later milestones append their links here.
export const NAV = {
  student: [
    { to: '/student', label: 'Home', icon: Home, end: true },
    { to: '/student/internships', label: 'Internships', icon: Search },
    { to: '/student/applications', label: 'Applications', icon: ClipboardCheck },
    { to: '/student/tests', label: 'Tests', icon: Timer },
  ],
  recruiter: [
    { to: '/recruiter', label: 'Home', icon: Home, end: true },
    { to: '/recruiter/listings', label: 'My listings', icon: Briefcase },
  ],
  admin: [
    { to: '/admin', label: 'Home', icon: Home, end: true },
    { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck },
    { to: '/admin/questions', label: 'Questions', icon: FileQuestion },
    { to: '/admin/tests', label: 'Tests', icon: ListChecks },
  ],
};

export const ICONS = { ClipboardCheck, FileText, User };
