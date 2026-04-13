1. **Analyze the Security Issue**:
   The `/mcp/connections` and `/mcp/tools/:provider` endpoints are intended to be part of the Admin panel for managing MCP tool permissions. However, they lack the admin role check (`user.roles?.includes('admin')`), allowing any authenticated user to access them.

2. **Implement Security Fix**:
   Add the role-based access control (RBAC) check `if (!user.roles?.includes('admin')) return c.json({ error: 'Forbidden: Admin access required' }, 403);` to both GET endpoints.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done**.
   I'll write tests and run `pre_commit_instructions`.

4. **Verify and Submit**:
   Run the backend tests, then create a PR.
