FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for extensions
RUN mkdir -p ten_packages/extension

# Expose WebSocket port
EXPOSE 8765

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run TEN Agent
CMD ["python", "-m", "ten.start", "--config", "property.json"]
