# Local test personas

`association-billing-personas.sql` creates login-ready scenarios for the SL.A.C
application and billing flows. All accounts use this local-development password:

```text
LocalTest123!
```

| Email | Scenario |
| --- | --- |
| `admin@chooselife.local` | SL.A.C association administrator |
| `new@chooselife.local` | Clean account with no application |
| `draft@chooselife.local` | Partially completed application draft |
| `awaiting-payment@chooselife.local` | Submitted application ready for its initial PIX payment |
| `initial-review@chooselife.local` | Initial payment claim awaiting admin review |
| `claim-rejected@chooselife.local` | Refused application with a voided obligation, ready to reapply |
| `monthly-current@chooselife.local` | Active monthly member with settled history |
| `monthly-overdue@chooselife.local` | Active monthly member with an overdue contribution |
| `annual-current@chooselife.local` | Active annual member with two years of history |
| `recurring-review@chooselife.local` | Active member with a recurring claim under review |

Dates are calculated from the database reset date. IDs and credentials are stable
between resets.
