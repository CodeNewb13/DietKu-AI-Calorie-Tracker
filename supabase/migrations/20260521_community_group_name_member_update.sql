-- Allow any group member to rename the group (not only the creator).

DROP POLICY IF EXISTS "Group members can update their groups" ON community_groups;

CREATE POLICY "Group members can update their groups"
  ON community_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM community_group_members m
      WHERE m.group_id = community_groups.id
        AND m.user_id = auth.uid()
    )
  );
