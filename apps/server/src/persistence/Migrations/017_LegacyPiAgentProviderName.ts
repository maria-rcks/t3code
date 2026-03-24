import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    UPDATE provider_session_runtime
    SET
      provider_name = CASE
        WHEN provider_name = 'piAgent' THEN 'codex'
        ELSE provider_name
      END,
      adapter_key = CASE
        WHEN adapter_key = 'piAgent' THEN 'codex'
        ELSE adapter_key
      END
    WHERE provider_name = 'piAgent' OR adapter_key = 'piAgent'
  `;

  yield* sql`
    UPDATE projection_thread_sessions
    SET provider_name = 'codex'
    WHERE provider_name = 'piAgent'
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = json_set(payload_json, '$.provider', 'codex')
    WHERE json_extract(payload_json, '$.provider') = 'piAgent'
  `;

  yield* sql`
    UPDATE orchestration_events
    SET metadata_json = json_set(metadata_json, '$.adapterKey', 'codex')
    WHERE json_extract(metadata_json, '$.adapterKey') = 'piAgent'
  `;
});
