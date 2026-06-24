import unittest

import app


class RecordingCursor:
    def __init__(self):
        self.statements = []

    def execute(self, query, params=None):
        params = tuple(params or ())
        self.assert_placeholder_count(query, params)
        self.statements.append((" ".join(query.split()), params))

    @staticmethod
    def assert_placeholder_count(query, params):
        expected = query.count("%s")
        if expected != len(params):
            raise AssertionError(f"SQL expected {expected} parameters but received {len(params)}")


class RelationalWorkspaceTests(unittest.TestCase):
    def test_workspace_maps_to_normalized_relations(self):
        cursor = RecordingCursor()
        workspace = {
            "jobs": [
                {
                    "id": "job-1",
                    "company": "Example",
                    "role": "Software Engineer Intern",
                    "season": "2027",
                    "deadline": "2026-07-15",
                    "location": "Remote",
                    "mode": "Remote",
                    "stage": "oa",
                    "match": 92,
                    "tags": ["Python", "Backend"],
                    "oaAttempts": [
                        {
                            "id": "oa-1",
                            "completedAt": "2026-06-24T15:00:00Z",
                            "durationMinutes": 90,
                            "questionTypes": ["Coding", "SQL"],
                            "result": "Completed",
                            "reflection": "Review joins.",
                        }
                    ],
                    "activity": [
                        {"id": "activity-1", "type": "saved", "at": "2026-06-23T10:00:00Z"},
                        {"id": "activity-2", "type": "applied", "at": "2026-06-24T10:00:00Z"},
                    ],
                }
            ],
            "tasks": [{"id": "task-1", "title": "Prepare OA", "sourceJobId": "job-1"}],
            "contacts": [{"id": "contact-1", "name": "Recruiter", "sourceJobId": "job-1"}],
            "documents": [{"id": "document-1", "name": "Resume", "sourceJobId": "job-1"}],
            "goal": {"target": 20, "deadline": "2026-07-31", "label": "July applications"},
            "notificationState": {
                "readIds": ["task:task-1"],
                "dismissedIds": ["goal:weekly"],
                "browserAlerts": True,
            },
        }

        normalized = app._replace_workspace_rows(cursor, "user-1", workspace)
        sql = "\n".join(statement for statement, _ in cursor.statements)

        expected_relations = {
            "jobs",
            "job_tags",
            "job_oa_attempts",
            "job_oa_question_types",
            "job_activities",
            "tasks",
            "contacts",
            "documents",
            "goals",
            "notification_settings",
            "notification_reads",
            "notification_dismissals",
            "workspace_meta",
        }
        for relation in expected_relations:
            self.assertIn(relation, sql)

        self.assertNotIn("workspace_data", sql)
        self.assertEqual(normalized["jobs"][0]["oaAttempts"][0]["questionTypes"], ["Coding", "SQL"])
        self.assertEqual(normalized["tasks"][0]["sourceJobId"], "job-1")
        self.assertTrue(normalized["notificationState"]["browserAlerts"])

    def test_schema_metadata_declares_bcnf(self):
        self.assertEqual(app.DATABASE_SCHEMA_VERSION, 2)
        self.assertEqual(app.DATABASE_NORMAL_FORM, "BCNF")


if __name__ == "__main__":
    unittest.main()
