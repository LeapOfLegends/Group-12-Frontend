pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'capstone-frontend'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log --oneline -1'
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run test:ci'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Docker Build') {
            when {
                branch 'main'
            }
            steps {
                sh 'docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} -t ${DOCKER_IMAGE}:latest .'
            }
        }

        stage('Deploy to VM') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    docker network inspect capstone-net >/dev/null 2>&1 || docker network create capstone-net
                    docker stop capstone-frontend || true
                    docker rm capstone-frontend || true
                    docker run -d --name capstone-frontend --network capstone-net -p 4200:80 ${DOCKER_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }
    }
}
