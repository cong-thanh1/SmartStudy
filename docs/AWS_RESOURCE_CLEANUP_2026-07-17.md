# AWS resource cleanup — 2026-07-17

## Production resources retained

- Amplify app `d1a5aw4t01ph7r` with `main` and `staging` branches.
- `SmartStudy-production-Foundation` and `SmartStudy-staging-Foundation`.
- API Gateway, Lambda API/ingestion, Cognito, S3 documents, DynamoDB,
  SQS/DLQ, CloudWatch alarms and SSM parameters used by those stacks.
- Production PostgreSQL data from the retired Singapore deployment is retained
  in the encrypted snapshot `smartstudy-postgres-final-20260717`.
- Six legacy PDF files were copied under
  `legacy-archive/ap-southeast-1/users/` in the retained production bucket.

## Standalone resources removed

- Broken `smartstudy-report-demo` API, empty S3 bucket and unused IAM roles.
- Retired Amplify app `d3g9kbk28ez9xf`.
- Retired Singapore backend stack `smartstudy-backend-prod`.
- Retired Singapore Cognito user pool and S3 documents bucket after archival.
- Retired Singapore RDS instance after the final encrypted snapshot completed.
- Empty `UsersTable` resources that were not configured in either Lambda.
- Unused staging Gemini parameter and its unused Lambda IAM permission.

## Bedrock removal rationale

Both live stacks use `LLM_PROVIDER=llama-cpp`,
`DOCUMENT_INGESTION_MODE=dynamodb`, `VECTOR_STORE=dynamodb-chunks` and
`EMBEDDING_PROVIDER=none`. The Bedrock Knowledge Bases had no ingestion jobs,
so their S3 Vectors buckets/indexes, service roles and wildcard permissions were
not on the production path. This change removes those resources from CDK so
future deployments do not recreate them.

## Follow-up operations

- Investigate and resolve messages in the production and staging DLQs before
  purging or redriving them.
- Keep the encrypted final RDS snapshot until the agreed retention period ends.
- Re-provision Bedrock only through a reviewed feature that switches the active
  providers and includes an end-to-end ingestion/retrieval test.
