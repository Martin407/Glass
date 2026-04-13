1. Add tests in `backend/src/auth.test.ts` to exercise the Okta authentication middleware validation.
   - The tests will provide `app.fetch` with missing or invalid `OKTA_DOMAIN`, `OKTA_ISSUER`, and `OKTA_AUDIENCE` / `OKTA_CLIENT_ID` configuration in the bindings environment.
   - The test will assert that a 500 error is returned with a generic response body `{"error": "Authentication is misconfigured"}`.
   - The test will assert that the response body does *not* contain the specific okta config string values.
   - The test will assert that `console.error` is called with the detailed error message for admin debugging.
   - *Note: I already implemented this test and verified it works. I just need to add it to the final plan.*
2. Complete pre commit steps
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
3. Submit
   - Commit the changes and submit the branch.
