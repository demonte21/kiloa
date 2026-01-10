# Build Stage
FROM golang:1.21-alpine AS builder

WORKDIR /src

# Copy the entire project
COPY . .

# Move to dashboard directory
WORKDIR /src/dashboard

# Download dependencies
RUN go mod download

# Build the binary
# CGO_ENABLED=0 ensures a static binary (pure Go)
RUN CGO_ENABLED=0 GOOS=linux go build -o kiloa-dashboard main.go

# Runtime Stage
FROM alpine:latest

WORKDIR /app

# Install certificates for HTTPS calls
RUN apk --no-cache add ca-certificates

# Copy binary from builder
COPY --from=builder /src/dashboard/kiloa-dashboard .

# Copy templates (critical for UI)
COPY --from=builder /src/dashboard/templates ./templates

# Set default environment variables
ENV KILOA_TOKEN=secret
ENV PORT=8080
ENV GIN_MODE=release

# Expose port
EXPOSE 8080

# Run the dashboard
CMD ["./kiloa-dashboard"]
