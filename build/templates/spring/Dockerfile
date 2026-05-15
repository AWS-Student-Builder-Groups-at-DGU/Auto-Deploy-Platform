# Spring Boot (Gradle / Maven 둘 다 지원)
FROM eclipse-temurin:17-jdk AS builder
WORKDIR /app
COPY . .
RUN if [ -f gradlew ]; then \
        chmod +x gradlew && ./gradlew bootJar -x test && \
        cp build/libs/*.jar /app.jar; \
    elif [ -f mvnw ]; then \
        chmod +x mvnw && ./mvnw clean package -DskipTests && \
        cp target/*.jar /app.jar; \
    else \
        echo "No gradlew or mvnw found in repo root" && exit 1; \
    fi

FROM eclipse-temurin:17-jre
COPY --from=builder /app.jar /app.jar
EXPOSE 8080
ENV SERVER_PORT=8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
