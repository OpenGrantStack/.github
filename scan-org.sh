#!/usr/bin/env bash
# OpenGrantStack – Organization Completion Scanner
# Requires: gh (GitHub CLI), jq, git
# Usage: ./scripts/scan-org.sh
# Output: status/report.md + status/<repo>.json

set -euo pipefail

ORG="OpenGrantStack"
STATUS_DIR="status"
REPORT="${STATUS_DIR}/report.md"
TODAY=$(date -u +%Y-%m-%d)

mkdir -p "${STATUS_DIR}"

echo "Scanning organization: ${ORG}"
echo "Date: ${TODAY}"
echo

# ------------------------------------------------------------
# Helper: calculate score for one repo
# ------------------------------------------------------------
score_repo() {
  local repo="$1"
  local full="${ORG}/${repo}"
  local score=0
  local details=()

  # 1. Description (5%)
  local desc
  desc=$(gh api "repos/${full}" --jq '.description // empty' 2>/dev/null || true)
  if [[ -n "${desc}" ]]; then
    score=$((score + 5))
    details+=("description: yes")
  else
    details+=("description: no")
  fi

  # 2. Topics (5%)
  local topics
  topics=$(gh api "repos/${full}" --jq '.topics | length' 2>/dev/null || echo 0)
  if [[ "${topics}" -gt 0 ]]; then
    score=$((score + 5))
    details+=("topics: yes (${topics})")
  else
    details+=("topics: no")
  fi

  # 3. LICENSE (10%)
  if gh api "repos/${full}/contents/LICENSE" --jq '.name' &>/dev/null || \
     gh api "repos/${full}/contents/LICENSE.md" --jq '.name' &>/dev/null; then
    score=$((score + 10))
    details+=("license: yes")
  else
    details+=("license: no")
  fi

  # 4. README size (10%)
  local readme_size
  readme_size=$(gh api "repos/${full}/contents/README.md" --jq '.size // 0' 2>/dev/null || echo 0)
  if [[ "${readme_size}" -ge 500 ]]; then
    score=$((score + 10))
    details+=("readme: yes (${readme_size} bytes)")
  else
    details+=("readme: no or too small (${readme_size})")
  fi

  # 5. Tests (15%) – heuristic via tree or search
  # Simplified: look for common test indicators in the default branch tree
  local has_tests=0
  if gh api "repos/${full}/git/trees/HEAD?recursive=1" --jq '.tree[].path' 2>/dev/null | \
     grep -E -q '(^|/)(tests?|__tests__)/|(_test\.|\.test\.|\.spec\.)'; then
    has_tests=1
  fi
  if [[ "${has_tests}" -eq 1 ]]; then
    score=$((score + 15))
    details+=("tests: yes")
  else
    details+=("tests: no")
  fi

  # 6. CI workflows (15%)
  local workflows
  workflows=$(gh api "repos/${full}/contents/.github/workflows" --jq 'length' 2>/dev/null || echo 0)
  if [[ "${workflows}" -gt 0 ]]; then
    score=$((score + 15))
    details+=("ci: yes (${workflows} files)")
  else
    details+=("ci: no")
  fi

  # 7. Recent commit (20%)
  local last_commit
  last_commit=$(gh api "repos/${full}/commits?per_page=1" --jq '.[0].commit.committer.date // empty' 2>/dev/null || true)
  if [[ -n "${last_commit}" ]]; then
    local days_ago
    days_ago=$(( ( $(date -u +%s) - $(date -u -d "${last_commit}" +%s) ) / 86400 ))
    if [[ "${days_ago}" -le 90 ]]; then
      score=$((score + 20))
      details+=("recent: yes (${days_ago} days ago)")
    else
      details+=("recent: no (${days_ago} days ago)")
    fi
  else
    details+=("recent: unknown")
  fi

  # 8. Release or tag (20%)
  local releases
  releases=$(gh api "repos/${full}/releases" --jq 'length' 2>/dev/null || echo 0)
  local tags
  tags=$(gh api "repos/${full}/tags" --jq 'length' 2>/dev/null || echo 0)
  if [[ "${releases}" -gt 0 || "${tags}" -gt 0 ]]; then
    score=$((score + 20))
    details+=("release/tag: yes")
  else
    details+=("release/tag: no")
  fi

  # Determine tier + color
  local tier color
  if   [[ ${score} -ge 90 ]]; then tier="Mainnet";          color="purple"
  elif [[ ${score} -ge 75 ]]; then tier="Production-Ready"; color="green"
  elif [[ ${score} -ge 50 ]]; then tier="Active";           color="yellow"
  elif [[ ${score} -ge 25 ]]; then tier="Prototype";        color="orange"
  else                            tier="Concept";          color="red"
  fi

  # Write shields.io JSON
  cat > "${STATUS_DIR}/${repo}.json" <<EOF
{
  "schemaVersion": 1,
  "label": "completion",
  "message": "${score}%",
  "color": "${color}"
}
EOF

  # Return values for the report
  echo "${score}|${tier}|${repo}|${details[*]}"
}

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------
echo "Fetching repository list..."
mapfile -t REPOS < <(gh api "orgs/${ORG}/repos?per_page=100" --jq '.[].name' 2>/dev/null || true)

if [[ ${#REPOS[@]} -eq 0 ]]; then
  echo "No repositories found or authentication failed."
  echo "Run: gh auth login"
  exit 1
fi

echo "Found ${#REPOS[@]} repositories. Scoring..."
echo

declare -a RESULTS=()
for repo in "${REPOS[@]}"; do
  echo "  → ${repo}"
  result=$(score_repo "${repo}" || echo "0|Concept|${repo}|error")
  RESULTS+=("${result}")
done

# ------------------------------------------------------------
# Generate report.md
# ------------------------------------------------------------
{
  echo "# OpenGrantStack – Completion Report"
  echo
  echo "Generated: ${TODAY}"
  echo
  echo "| Repo | Score | Tier |"
  echo "|------|-------|------|"

  # Sort by score descending (simple approach)
  for line in "${RESULTS[@]}"; do
    IFS='|' read -r score tier repo details <<< "${line}"
    echo "| [\`${repo}\`](https://github.com/${ORG}/${repo}) | ${score}% | ${tier} |"
  done

  echo
  echo "## Details"
  echo
  for line in "${RESULTS[@]}"; do
    IFS='|' read -r score tier repo details <<< "${line}"
    echo "### ${repo} — ${score}% (${tier})"
    echo "${details}"
    echo
  done
} > "${REPORT}"

echo
echo "Done."
echo "  Report  → ${REPORT}"
echo "  JSON    → ${STATUS_DIR}/*.json"
echo
echo "Tip: commit the status/ directory so shields.io badges work."
