import type { AppLocale } from "@/lib/i18n";

export type ItemStatus = "active" | "archived";
export type ListRole = "owner" | "editor";
export type ClassifierModel = "fast" | "smart" | "think";
export const classifierModels = ["fast", "smart", "think"] as const;

export type Viewer = {
  id: string;
  email: string | null;
};

export type ProfileRecord = {
  id: string;
  first_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  locale: AppLocale | null;
  created_at?: string;
};

export type ListRecord = {
  id: string;
  owner_user_id: string;
  title: string;
  share_slug: string;
  is_link_sharing_enabled: boolean;
  classifier_model: ClassifierModel;
  created_at: string;
  updated_at: string;
};

export type MemberRecord = {
  list_id: string;
  user_id: string;
  role: ListRole;
  joined_at: string;
  added_via_link: boolean;
  profile: ProfileRecord | null;
};

export type ListItemRecord = {
  id: string;
  list_id: string;
  name: string;
  normalized_name: string;
  category: string | null;
  custom_category_label: string | null;
  category_source: "ai" | "manual" | null;
  status: ItemStatus;
  sort_index: number;
  created_by: string;
  updated_by: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  last_mutation_id: string | null;
  last_mutation_device_id: string | null;
  _queued?: boolean;
  _optimistic?: boolean;
};

export type DashboardListRecord = ListRecord & {
  role: ListRole;
  member_count: number;
};

export type DashboardPayload = {
  profile: ProfileRecord | null;
  viewer: Viewer;
  lists: DashboardListRecord[];
};

export type ListPayload = {
  profile: ProfileRecord | null;
  viewer: Viewer;
  list: ListRecord;
  members: MemberRecord[];
  items: ListItemRecord[];
};

export type OfflineMutation =
  | {
      id: string;
      shareSlug: string;
      kind: "add";
      listId: string;
      itemId: string;
      name: string;
      sortIndex: number;
      deviceId: string;
      mutationId: string;
      createdAt: string;
    }
  | {
      id: string;
      shareSlug: string;
      kind: "updateName";
      itemId: string;
      name: string;
      deviceId: string;
      mutationId: string;
      createdAt: string;
    }
  | {
      id: string;
      shareSlug: string;
      kind: "setCategory";
      itemId: string;
      category: string | null;
      customLabel: string | null;
      deviceId: string;
      mutationId: string;
      createdAt: string;
    }
  | {
      id: string;
      shareSlug: string;
      kind: "archive" | "delete";
      itemId: string;
      deviceId: string;
      mutationId: string;
      createdAt: string;
    }
  | {
      id: string;
      shareSlug: string;
      kind: "restore";
      itemId: string;
      sortIndex: number;
      deviceId: string;
      mutationId: string;
      createdAt: string;
    };
