#!/usr/bin/env bash

set -euo pipefail

CLAN_TAG="%238LLCCCLL"

OUTFILE="currentwar.json"

TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjgxMDVjYTUyLTM0NzgtNDhhMS05ZjdmLTI3ZTA4N2VjOGI2NyIsImlhdCI6MTc2MTkyMjg5MSwic3ViIjoiZGV2ZWxvcGVyLzQwYmRkYWMwLWI4MjQtMjQ5Ni01ODk4LTU1MDk0M2E1MTQyZSIsInNjb3BlcyI6WyJjbGFzaCJdLCJsaW1pdHMiOlt7InRpZXIiOiJkZXZlbG9wZXIvc2lsdmVyIiwidHlwZSI6InRocm90dGxpbmcifSx7ImNpZHJzIjpbIjI0LjYzLjE5OC44NiJdLCJ0eXBlIjoiY2xpZW50In1dfQ.yP5Ig49VqZs2RDSO31dzrsV2pZSWkfmh-0pvXvcjaIc6Xig4JfuSaJX6yaHhCpFlbyOOGxv3KbQkxoCIDCD_EA"

# --- Run the API request ---
# -s = silent mode (no progress bar)
# -H = add a header
# jq = a tool that pretty-prints JSON
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.clashofclans.com/v1/clans/${CLAN_TAG}/currentwar" | jq '.' > "$OUTFILE"

echo "Saved current war data to $OUTFILE"
