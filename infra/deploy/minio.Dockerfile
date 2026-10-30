# Photo bucket of the Cubeship demo: the same MinIO as infra/docker-compose.yml,
# run as root because the image's own user cannot write to the app's volume.
FROM alpine/minio:RELEASE.2025-10-15T17-29-55Z@sha256:cf23643a6cf9ce159c57643ceb88279e431262282428c9e0bf3a7ef1a97e84b4
USER 0:0
