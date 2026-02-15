export interface Member {
  id: string;
  name: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  thumbnail_url: string | null;
  spine_color: string | null;
  google_books_id: string | null;
  description?: string | null;
  status: "reading" | "completed" | "upcoming";
  added_by: string | null;
  page_count: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  book_id: string;
  member_id: string;
  pre_rating: number | null;
  post_rating: number | null;
  rating_change_reason: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  member?: Member;
}

export interface DiscussionTopic {
  id: string;
  book_id: string;
  member_id: string | null;
  content: string;
  is_spoiler: boolean;
  created_at: string;
  member?: Member;
}

export interface Meeting {
  id: string;
  book_id: string | null;
  title: string;
  date: string;
  time: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  book?: Book;
}

export interface Attendance {
  id: string;
  meeting_id: string;
  member_id: string;
  status: "going" | "maybe" | "not_going";
  member?: Member;
}

export interface GoogleBooksResult {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}
