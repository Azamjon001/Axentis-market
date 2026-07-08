# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod ./

# Copy source to generate go.sum
COPY . .

# Generate go.sum and download dependencies
RUN go mod tidy && go mod download

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install CA certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy binary from builder
COPY --from=builder /app/main .
COPY --from=builder /app/.env .

# Copy Firebase Admin SDK credentials (optional - файл может отсутствовать)
# COPY --from=builder /app/firebase-admin-sdk.json .

# Copy migrations directory
COPY --from=builder /app/migrations ./migrations

# Expose port
EXPOSE 3000

# Run the application
CMD ["./main"]
