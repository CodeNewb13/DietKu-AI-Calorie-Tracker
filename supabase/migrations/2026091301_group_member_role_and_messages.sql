-- Two schema gaps the client code has always assumed but no migration ever created:
--
-- 1) community_group_members.role — CommunityContext selects it and inserts 'admin'
--    on group creation / 'member' on join, so group create, join, and member listing
--    all failed with "column community_group_members.role does not exist".
-- 2) community_group_messages — the group chat reads and writes this table and throws
--    on error, so chat was entirely non-functional.

-- ---------------------------------------------------------------------------
-- 1) Group member role
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_group_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_group_members_role_check'
  ) THEN
    ALTER TABLE public.community_group_members
      ADD CONSTRAINT community_group_members_role_check
      CHECK (role IN ('admin', 'member'));
  END IF;
END $$;

-- Existing rows predate the column: the group creator is the admin, everyone else a member.
UPDATE public.community_group_members m
SET role = 'admin'
FROM public.community_groups g
WHERE m.group_id = g.id
  AND m.user_id = g.created_by
  AND m.role <> 'admin';

-- ---------------------------------------------------------------------------
-- 2) Group chat messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.community_groups (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat loads oldest-first per group.
CREATE INDEX IF NOT EXISTS idx_community_group_messages_group_created
  ON public.community_group_messages (group_id, created_at);

COMMENT ON TABLE public.community_group_messages IS
  'Chat messages within a community group.';

ALTER TABLE public.community_group_messages ENABLE ROW LEVEL SECURITY;

-- is_member_of_group() is SECURITY DEFINER, keeping these checks non-recursive
-- (see 2026032703_harden_community_members_rls.sql).
DROP POLICY IF EXISTS "Group members can read group messages" ON public.community_group_messages;
CREATE POLICY "Group members can read group messages"
  ON public.community_group_messages FOR SELECT
  TO authenticated
  USING (public.is_member_of_group(group_id, auth.uid()));

DROP POLICY IF EXISTS "Group members can send messages as themselves" ON public.community_group_messages;
CREATE POLICY "Group members can send messages as themselves"
  ON public.community_group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_member_of_group(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authors can delete own messages" ON public.community_group_messages;
CREATE POLICY "Authors can delete own messages"
  ON public.community_group_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
