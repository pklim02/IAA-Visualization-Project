# NC State IAA - Career Services Dashboard

Interactive, automated recruitment and placement dashboard for the Institute for Advanced Analytics (IAA) Career Services team at North Carolina State University.

## Overview
Replaces manual spreadsheet updates with real-time analytics for monitoring student recruitment progress, employer engagement, sourcing channel ROI, and compensation benchmarks.

## 3 Core Streamlined Views
1. **Executive & Placement Outcomes**: Cohort placement rate (80.0%), recruitment stage pipeline funnel, placement velocity timeline, top corporate hiring partners, and discovery channel yields.
2. **Student Pipeline & Coaching Radar**: Complete 75-candidate directory with UnityID avatars, stage progress trackers, interview timeline histories, and an active triage radar highlighting candidates needing coaching.
3. **Data Dictionary & Replication Guide**: 100% transparent mapping from raw Google Forms CSV columns to metrics, with formula inspectors, Excel formulas, and Python replication snippets.

## Data Consistency & Column Mapping
- **Columns 1–4 (Common)**: Timestamp, Email Address, Last First Name, What are you reporting today? (`Interview`, `Offer`, or `Acceptance`).
- **Columns 5–8 (`Interview`)**: Company/Role/Dept, Interview Stage, Discovery Source, Technical Feedback Notes.
- **Columns 9–10 (`Offer`)**: Company and Job Title, Meet with Career Services flag.
- **Columns 11–14 (`Acceptance`)**: Company and Job Title, Final Offer breakdown (Salary & Bonus), Location, Working Conditions.

## Quick Start
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build
```

The application runs on Vite at `http://localhost:5173/`.
