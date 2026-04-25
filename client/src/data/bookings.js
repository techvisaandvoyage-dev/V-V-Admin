// ============================================================
//  Mock Bookings Data
//  Note: In a real app, this would come from an API/Database.
//  CLEARED: All previous mock data has been removed.
// ============================================================

export const BOOKING_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REVIEW: "review",
  REJECTED: "rejected",
  SUBMITTED: "submitted",
};

// Initial state is now empty to clear previous data.
export const BOOKINGS = [];

// Analytics helper
export const ANALYTICS = {
  totalBookings: 0,
  totalRevenue: 0,
  pending: 0,
  approved: 0,
  review: 0,
  rejected: 0,
  approvalRate: 0,
};

export const MONTHLY_REVENUE = [
  { month: "Jan", revenue: 0, bookings: 0 },
  { month: "Feb", revenue: 0, bookings: 0 },
  { month: "Mar", revenue: 0, bookings: 0 },
  { month: "Apr", revenue: 0, bookings: 0 },
  { month: "May", revenue: 0, bookings: 0 },
  { month: "Jun", revenue: 0, bookings: 0 },
];

export const bookings = [];
export const monthlyStats = [];
export const getAnalytics = () => ANALYTICS;
