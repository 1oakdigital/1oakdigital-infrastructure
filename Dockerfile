FROM debian:stable-slim



# Add system/runtime requirements, awscli, Pulumi
RUN apt-get update \
	&& apt-get install -y -f --no-install-recommends jq gettext curl git unzip binutils musl-dev libxslt-dev libffi-dev gnupg npm \
	&& curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"\
	&& unzip awscliv2.zip \
	&& ./aws/install -i /usr/local/aws-cli -b /usr/local/bin \
	&& rm -rf awscliv2.zip ./aws  \
  && curl -fsSL https://get.pulumi.com | sh
ENV PATH=$PATH:/root/.pulumi/bin
COPY package.json package-lock.json ./
RUN npm install


# Add Docker
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
	&& echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  buster stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
  	&& apt-get update  \
	&& apt-get install -y docker-ce docker-ce-cli containerd.io \
	&& rm -rf /var/lib/apt/lists/*

