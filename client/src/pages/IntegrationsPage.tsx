import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import IntegrationCard from '../components/integrations/IntegrationCard';
import IntegrationDetail from '../components/integrations/IntegrationDetail';
import { Search, ArrowLeft } from 'lucide-react';

const INTEGRATIONS_DATA = [
  {
    id: 'github',
    category: 'version-control',
    name: 'GitHub',
    description: 'Connect and manage your GitHub repositories',
    icon: '🐙',
    featured: true,
    rating: 4.9,
    reviews: 2543,
    downloads: '125K+',
    tags: ['version-control', 'collaboration', 'ci-cd'],
    longDescription: 'Seamlessly integrate with GitHub to clone, push, and manage repositories. Enable CI/CD workflows, automate deployments, and collaborate with your team directly from the editor.',
    features: [
      'Clone repositories',
      'Branch management',
      'Pull request creation',
      'CI/CD integration',
      'Webhook support',
      'Code review tools'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'gitlab',
    category: 'version-control',
    name: 'GitLab',
    description: 'GitLab repository and CI/CD integration',
    icon: '🦊',
    featured: true,
    rating: 4.8,
    reviews: 1852,
    downloads: '98K+',
    tags: ['version-control', 'ci-cd', 'devops'],
    longDescription: 'Full GitLab integration with repository management, pipeline execution, and issue tracking. Build, test, and deploy directly from your projects.',
    features: [
      'Repository access',
      'Pipeline management',
      'Issue tracking',
      'Merge request support',
      'Group management',
      'Security scanning'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'bitbucket',
    category: 'version-control',
    name: 'Bitbucket',
    description: 'Atlassian Bitbucket Git repository hosting',
    icon: '🪣',
    rating: 4.6,
    reviews: 1234,
    downloads: '72K+',
    tags: ['version-control', 'atlassian', 'ci-cd'],
    longDescription: 'Connect to Bitbucket Cloud or Server for Git repository management. Integrated with Jira and other Atlassian tools.',
    features: [
      'Repository management',
      'Pull requests',
      'Jira integration',
      'Branch permissions',
      'Pipelines',
      'Code insights'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'openai',
    category: 'ai-coding',
    name: 'OpenAI',
    description: 'AI-powered code assistance and completion',
    icon: '🤖',
    featured: true,
    rating: 4.7,
    reviews: 3421,
    downloads: '256K+',
    tags: ['ai-coding', 'code-generation', 'documentation'],
    longDescription: 'Harness the power of GPT for intelligent code suggestions, documentation generation, and code reviews. Get real-time assistance as you write code.',
    features: [
      'Code completion',
      'Documentation generation',
      'Code review',
      'Bug detection',
      'Refactoring suggestions',
      'Custom prompts'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'copilot',
    category: 'ai-coding',
    name: 'GitHub Copilot',
    description: 'AI pair programmer for code suggestions',
    icon: '🧑‍✈️',
    featured: true,
    rating: 4.8,
    reviews: 4567,
    downloads: '312K+',
    tags: ['ai-coding', 'code-generation', 'productivity'],
    longDescription: 'Your AI pair programmer that suggests whole lines or entire functions right inside your editor. Powered by OpenAI Codex.',
    features: [
      'Real-time suggestions',
      'Multi-language support',
      'Context-aware completions',
      'Test generation',
      'Comment-to-code',
      'Code explanations'
    ],
    pricing: 'Paid',
    verified: true
  },
  {
    id: 'tabnine',
    category: 'ai-coding',
    name: 'Tabnine',
    description: 'AI code completion for all languages',
    icon: '🧠',
    rating: 4.6,
    reviews: 2987,
    downloads: '198K+',
    tags: ['ai-coding', 'code-completion', 'productivity'],
    longDescription: 'AI-powered code completion trained on billions of lines of code. Works with all major programming languages and frameworks.',
    features: [
      'Smart completions',
      'Team learning',
      'Privacy-focused',
      'Local mode',
      'Multi-language support',
      'IDE integration'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'codeium',
    category: 'ai-coding',
    name: 'Codeium',
    description: 'Free AI-powered code acceleration',
    icon: '⚡',
    rating: 4.7,
    reviews: 1876,
    downloads: '143K+',
    tags: ['ai-coding', 'code-completion', 'free'],
    longDescription: 'Free AI code acceleration toolkit with autocomplete, natural language search, and chat assistance.',
    features: [
      'Intelligent autocomplete',
      'Natural language search',
      'Code explanations',
      'Refactoring assistance',
      'Multi-language support',
      'Privacy protection'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'docker',
    category: 'devops',
    name: 'Docker',
    description: 'Containerization and Docker management',
    icon: '🐳',
    featured: true,
    rating: 4.6,
    reviews: 1923,
    downloads: '87K+',
    tags: ['devops', 'containerization', 'deployment'],
    longDescription: 'Build, manage, and deploy Docker containers directly from the editor. Support for Dockerfiles, docker-compose, and registry management.',
    features: [
      'Docker build',
      'Container management',
      'Docker Compose support',
      'Registry integration',
      'Image scanning',
      'Performance monitoring'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'kubernetes',
    category: 'devops',
    name: 'Kubernetes',
    description: 'Kubernetes cluster management and deployment',
    icon: '☸️',
    rating: 4.7,
    reviews: 2134,
    downloads: '145K+',
    tags: ['devops', 'orchestration', 'cloud-native'],
    longDescription: 'Manage Kubernetes clusters, deploy applications, and monitor workloads. Full kubectl integration with visual cluster explorer.',
    features: [
      'Cluster management',
      'Pod deployment',
      'Resource monitoring',
      'Helm charts',
      'Namespace management',
      'Log streaming'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'terraform',
    category: 'devops',
    name: 'Terraform',
    description: 'Infrastructure as Code management',
    icon: '🏗️',
    rating: 4.8,
    reviews: 1765,
    downloads: '94K+',
    tags: ['devops', 'iac', 'automation'],
    longDescription: 'Manage infrastructure as code with Terraform. Plan, apply, and track infrastructure changes across cloud providers.',
    features: [
      'State management',
      'Plan visualization',
      'Module support',
      'Cloud provider integration',
      'Remote backends',
      'Variable management'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'ansible',
    category: 'devops',
    name: 'Ansible',
    description: 'Configuration management and automation',
    icon: '🔧',
    rating: 4.6,
    reviews: 1543,
    downloads: '78K+',
    tags: ['devops', 'automation', 'configuration'],
    longDescription: 'Automate configuration management, application deployment, and orchestration with Ansible playbooks.',
    features: [
      'Playbook execution',
      'Inventory management',
      'Role organization',
      'Vault integration',
      'Task automation',
      'Module library'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'jenkins',
    category: 'devops',
    name: 'Jenkins',
    description: 'Continuous integration and delivery server',
    icon: '🏭',
    rating: 4.5,
    reviews: 2345,
    downloads: '156K+',
    tags: ['ci-cd', 'automation', 'devops'],
    longDescription: 'Automate building, testing, and deploying applications with Jenkins pipelines. Extensive plugin ecosystem.',
    features: [
      'Pipeline as code',
      'Build automation',
      'Plugin integration',
      'Distributed builds',
      'Job scheduling',
      'Build artifacts'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'postgresql',
    category: 'database',
    name: 'PostgreSQL',
    description: 'PostgreSQL database client and management',
    icon: '🐘',
    rating: 4.8,
    reviews: 1654,
    downloads: '76K+',
    tags: ['database', 'sql', 'data-management'],
    longDescription: 'Full PostgreSQL database integration with query builder, schema management, and data visualization tools.',
    features: [
      'Query execution',
      'Schema management',
      'Data visualization',
      'Backup management',
      'Performance analysis',
      'Migration tools'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'mongodb',
    category: 'database',
    name: 'MongoDB',
    description: 'MongoDB NoSQL database integration',
    icon: '🍃',
    rating: 4.7,
    reviews: 1432,
    downloads: '64K+',
    tags: ['database', 'nosql', 'data-management'],
    longDescription: 'Connect to MongoDB clusters and manage collections, documents, and aggregation pipelines. Built-in query builder and data explorer.',
    features: [
      'Collection management',
      'Query builder',
      'Aggregation pipeline',
      'Index management',
      'Data export/import',
      'Replication tools'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'mysql',
    category: 'database',
    name: 'MySQL',
    description: 'MySQL database client and tools',
    icon: '🐬',
    rating: 4.7,
    reviews: 1876,
    downloads: '89K+',
    tags: ['database', 'sql', 'relational'],
    longDescription: 'Connect to MySQL databases with advanced query tools, schema designer, and performance optimization features.',
    features: [
      'Query editor',
      'Schema designer',
      'Data import/export',
      'User management',
      'Query optimization',
      'Backup tools'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'redis',
    category: 'database',
    name: 'Redis',
    description: 'Redis in-memory data store manager',
    icon: '🔴',
    rating: 4.8,
    reviews: 1234,
    downloads: '67K+',
    tags: ['database', 'cache', 'key-value'],
    longDescription: 'Manage Redis databases with key browser, CLI integration, and real-time monitoring. Support for all Redis data types.',
    features: [
      'Key browser',
      'CLI integration',
      'Real-time monitoring',
      'Pub/Sub support',
      'Cluster management',
      'Data visualization'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'elasticsearch',
    category: 'database',
    name: 'Elasticsearch',
    description: 'Elasticsearch search and analytics engine',
    icon: '🔍',
    rating: 4.6,
    reviews: 987,
    downloads: '54K+',
    tags: ['database', 'search', 'analytics'],
    longDescription: 'Connect to Elasticsearch clusters for full-text search, log analytics, and data exploration. Visual query builder included.',
    features: [
      'Index management',
      'Query builder',
      'Aggregations',
      'Mapping editor',
      'Cluster monitoring',
      'Bulk operations'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'supabase',
    category: 'database',
    name: 'Supabase',
    description: 'Open source Firebase alternative',
    icon: '⚡',
    rating: 4.9,
    reviews: 2456,
    downloads: '134K+',
    tags: ['database', 'backend', 'realtime'],
    longDescription: 'Complete backend-as-a-service with PostgreSQL database, authentication, storage, and real-time subscriptions.',
    features: [
      'Database management',
      'Authentication',
      'Storage buckets',
      'Real-time subscriptions',
      'Edge functions',
      'Auto-generated APIs'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'stripe',
    category: 'payments',
    name: 'Stripe',
    description: 'Payment processing and billing integration',
    icon: '💳',
    rating: 4.9,
    reviews: 2187,
    downloads: '142K+',
    tags: ['payments', 'billing', 'commerce'],
    longDescription: 'Integrate Stripe payment processing into your applications. Manage subscriptions, invoices, and payment tracking.',
    features: [
      'Payment processing',
      'Subscription management',
      'Invoice generation',
      'Webhook handling',
      'Refund management',
      'Analytics dashboard'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'paypal',
    category: 'payments',
    name: 'PayPal',
    description: 'PayPal payment and checkout integration',
    icon: '💰',
    rating: 4.5,
    reviews: 1765,
    downloads: '98K+',
    tags: ['payments', 'checkout', 'commerce'],
    longDescription: 'Accept PayPal payments with smart payment buttons, subscription billing, and invoice management.',
    features: [
      'Payment buttons',
      'Subscription billing',
      'Invoice management',
      'Dispute handling',
      'Multi-currency support',
      'Seller protection'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'square',
    category: 'payments',
    name: 'Square',
    description: 'Square payment processing platform',
    icon: '⬜',
    rating: 4.6,
    reviews: 1432,
    downloads: '76K+',
    tags: ['payments', 'pos', 'commerce'],
    longDescription: 'Integrate Square payment processing for online and in-person sales. Includes inventory and customer management.',
    features: [
      'Payment processing',
      'POS integration',
      'Inventory management',
      'Customer profiles',
      'Invoicing',
      'Analytics'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'slack',
    category: 'communication',
    name: 'Slack',
    description: 'Slack workspace integration and notifications',
    icon: '💬',
    rating: 4.6,
    reviews: 1876,
    downloads: '104K+',
    tags: ['communication', 'notifications', 'collaboration'],
    longDescription: 'Send notifications, messages, and updates to Slack. Integrate with build systems and deployment pipelines.',
    features: [
      'Message sending',
      'Channel management',
      'Webhook integration',
      'User management',
      'Notification routing',
      'Message threading'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'discord',
    category: 'communication',
    name: 'Discord',
    description: 'Discord bot and webhook integration',
    icon: '🎮',
    rating: 4.7,
    reviews: 2134,
    downloads: '123K+',
    tags: ['communication', 'bot', 'community'],
    longDescription: 'Create Discord bots, send webhooks, and manage servers. Perfect for community engagement and notifications.',
    features: [
      'Bot creation',
      'Webhook posting',
      'Server management',
      'Role automation',
      'Message embeds',
      'Slash commands'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'teams',
    category: 'communication',
    name: 'Microsoft Teams',
    description: 'Microsoft Teams collaboration integration',
    icon: '👥',
    rating: 4.5,
    reviews: 1543,
    downloads: '87K+',
    tags: ['communication', 'microsoft', 'enterprise'],
    longDescription: 'Integrate with Microsoft Teams for enterprise collaboration. Send notifications, create channels, and manage teams.',
    features: [
      'Message posting',
      'Team management',
      'Channel creation',
      'Adaptive cards',
      'Bot framework',
      'File sharing'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'sendgrid',
    category: 'communication',
    name: 'SendGrid',
    description: 'Email delivery and marketing platform',
    icon: '📧',
    rating: 4.7,
    reviews: 1987,
    downloads: '112K+',
    tags: ['email', 'marketing', 'transactional'],
    longDescription: 'Send transactional and marketing emails with SendGrid. Advanced analytics and template management included.',
    features: [
      'Email API',
      'Template editor',
      'Analytics dashboard',
      'List management',
      'A/B testing',
      'Webhook events'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'twilio',
    category: 'communication',
    name: 'Twilio',
    description: 'SMS, voice, and video communication APIs',
    icon: '📱',
    rating: 4.8,
    reviews: 2345,
    downloads: '134K+',
    tags: ['sms', 'voice', 'video'],
    longDescription: 'Build communication features with Twilio APIs. Send SMS, make calls, and enable video conferencing.',
    features: [
      'SMS messaging',
      'Voice calls',
      'Video rooms',
      'Verify API',
      'Chat API',
      'WhatsApp integration'
    ],
    pricing: 'Pay-as-you-go',
    verified: true
  },
  {
    id: 'aws',
    category: 'cloud',
    name: 'AWS',
    description: 'Amazon Web Services cloud integration',
    icon: '☁️',
    rating: 4.7,
    reviews: 2654,
    downloads: '189K+',
    tags: ['cloud', 'devops', 'deployment'],
    longDescription: 'Complete AWS integration for deploying applications, managing resources, and accessing cloud services.',
    features: [
      'EC2 management',
      'S3 bucket access',
      'Lambda functions',
      'Database services',
      'Container services',
      'IAM management'
    ],
    pricing: 'Pay-as-you-go',
    verified: true
  },
  {
    id: 'gcp',
    category: 'cloud',
    name: 'Google Cloud',
    description: 'Google Cloud Platform integration',
    icon: '🌐',
    rating: 4.6,
    reviews: 1543,
    downloads: '98K+',
    tags: ['cloud', 'devops', 'deployment'],
    longDescription: 'Deploy to Google Cloud Platform with integrated project management, compute resources, and data services.',
    features: [
      'Compute Engine',
      'App Engine',
      'Cloud Storage',
      'Firestore',
      'Cloud Functions',
      'Kubernetes Engine'
    ],
    pricing: 'Pay-as-you-go',
    verified: true
  },
  {
    id: 'azure',
    category: 'cloud',
    name: 'Microsoft Azure',
    description: 'Azure cloud platform integration',
    icon: '🔷',
    rating: 4.7,
    reviews: 2134,
    downloads: '145K+',
    tags: ['cloud', 'microsoft', 'enterprise'],
    longDescription: 'Deploy and manage Azure resources with full cloud platform integration. Support for VMs, containers, and serverless.',
    features: [
      'Virtual machines',
      'App Services',
      'Azure Functions',
      'Cosmos DB',
      'Container instances',
      'Active Directory'
    ],
    pricing: 'Pay-as-you-go',
    verified: true
  },
  {
    id: 'digitalocean',
    category: 'cloud',
    name: 'DigitalOcean',
    description: 'Developer-friendly cloud infrastructure',
    icon: '🌊',
    rating: 4.8,
    reviews: 1876,
    downloads: '92K+',
    tags: ['cloud', 'hosting', 'infrastructure'],
    longDescription: 'Simple cloud infrastructure for developers. Manage droplets, databases, and Kubernetes clusters.',
    features: [
      'Droplet management',
      'Managed databases',
      'Kubernetes clusters',
      'Spaces storage',
      'Load balancers',
      'Monitoring'
    ],
    pricing: 'Pay-as-you-go',
    verified: true
  },
  {
    id: 'cloudflare',
    category: 'cloud',
    name: 'Cloudflare',
    description: 'CDN, security, and edge computing platform',
    icon: '🛡️',
    rating: 4.9,
    reviews: 2987,
    downloads: '178K+',
    tags: ['cdn', 'security', 'edge'],
    longDescription: 'Global CDN, DDoS protection, and edge computing. Workers for serverless code execution at the edge.',
    features: [
      'CDN management',
      'Workers deployment',
      'DNS management',
      'WAF rules',
      'Analytics',
      'Page rules'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'vercel',
    category: 'deployment',
    name: 'Vercel',
    description: 'Frontend deployment and hosting platform',
    icon: '▲',
    rating: 4.8,
    reviews: 2134,
    downloads: '156K+',
    tags: ['deployment', 'hosting', 'frontend'],
    longDescription: 'Deploy frontend applications with automatic builds, previews, and global CDN. Perfect for Next.js and static sites.',
    features: [
      'Automatic deployments',
      'Preview URLs',
      'Environment variables',
      'Analytics',
      'Performance monitoring',
      'Custom domains'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'netlify',
    category: 'deployment',
    name: 'Netlify',
    description: 'Modern web hosting and automation platform',
    icon: '🎯',
    rating: 4.7,
    reviews: 1987,
    downloads: '143K+',
    tags: ['deployment', 'hosting', 'jamstack'],
    longDescription: 'Deploy static sites and serverless functions with continuous deployment from Git. Built for the Jamstack.',
    features: [
      'Git-based deployments',
      'Serverless functions',
      'Form handling',
      'Identity management',
      'Split testing',
      'Analytics'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'heroku',
    category: 'deployment',
    name: 'Heroku',
    description: 'Cloud application platform and hosting',
    icon: '💜',
    rating: 4.5,
    reviews: 1687,
    downloads: '87K+',
    tags: ['deployment', 'hosting', 'backend'],
    longDescription: 'Deploy full-stack applications with integrated databases, add-ons, and automatic scaling.',
    features: [
      'Dyno management',
      'Database hosting',
      'Add-ons marketplace',
      'Automatic scaling',
      'Buildpacks',
      'Pipeline management'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'railway',
    category: 'deployment',
    name: 'Railway',
    description: 'Infrastructure platform for instant deployments',
    icon: '🚂',
    rating: 4.8,
    reviews: 1234,
    downloads: '67K+',
    tags: ['deployment', 'hosting', 'infrastructure'],
    longDescription: 'Deploy applications instantly with zero configuration. Includes databases, cron jobs, and environment management.',
    features: [
      'One-click deployments',
      'Database templates',
      'Cron jobs',
      'Private networking',
      'Environment variables',
      'Usage-based pricing'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'render',
    category: 'deployment',
    name: 'Render',
    description: 'Cloud platform for modern applications',
    icon: '🎨',
    rating: 4.7,
    reviews: 1456,
    downloads: '78K+',
    tags: ['deployment', 'hosting', 'full-stack'],
    longDescription: 'Deploy web services, static sites, and databases with automatic SSL and global CDN. Zero DevOps required.',
    features: [
      'Web services',
      'Static sites',
      'Databases',
      'Cron jobs',
      'Private services',
      'Auto-scaling'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'npm',
    category: 'package-management',
    name: 'npm Registry',
    description: 'NPM package management and publishing',
    icon: '📦',
    rating: 4.7,
    reviews: 1954,
    downloads: '134K+',
    tags: ['package-management', 'dependencies', 'javascript'],
    longDescription: 'Publish, manage, and install npm packages. Search the registry and manage dependencies.',
    features: [
      'Package publishing',
      'Version management',
      'Dependency resolution',
      'Scope management',
      'Access controls',
      'Analytics'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'yarn',
    category: 'package-management',
    name: 'Yarn',
    description: 'Fast, reliable package manager',
    icon: '🧶',
    rating: 4.6,
    reviews: 1678,
    downloads: '98K+',
    tags: ['package-management', 'dependencies', 'javascript'],
    longDescription: 'Alternative package manager with improved performance and reliability. Support for workspaces and plugins.',
    features: [
      'Fast installs',
      'Workspaces',
      'Offline mode',
      'Deterministic installs',
      'Plugin system',
      'Zero-installs'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'pnpm',
    category: 'package-management',
    name: 'pnpm',
    description: 'Efficient package manager with disk space optimization',
    icon: '⚡',
    rating: 4.8,
    reviews: 987,
    downloads: '56K+',
    tags: ['package-management', 'performance', 'javascript'],
    longDescription: 'Disk space efficient package manager that uses content-addressable storage. Fast and strict dependency management.',
    features: [
      'Disk space optimization',
      'Monorepo support',
      'Strict mode',
      'Fast installations',
      'Workspace protocol',
      'Peer dependencies'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'sentry',
    category: 'monitoring',
    name: 'Sentry',
    description: 'Error tracking and performance monitoring',
    icon: '⚠️',
    rating: 4.8,
    reviews: 2321,
    downloads: '167K+',
    tags: ['monitoring', 'error-tracking', 'debugging'],
    longDescription: 'Track errors in production, monitor performance, and get real-time alerts for issues in your application.',
    features: [
      'Error tracking',
      'Performance monitoring',
      'Release tracking',
      'Source maps support',
      'Custom alerts',
      'Issue management'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'datadog',
    category: 'monitoring',
    name: 'Datadog',
    description: 'Infrastructure and application monitoring',
    icon: '📊',
    rating: 4.7,
    reviews: 1876,
    downloads: '112K+',
    tags: ['monitoring', 'analytics', 'devops'],
    longDescription: 'Monitor infrastructure, applications, and user experience. Unified visibility across your entire stack.',
    features: [
      'Infrastructure monitoring',
      'APM',
      'Log management',
      'Synthetic monitoring',
      'Custom dashboards',
      'Alerting'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'newrelic',
    category: 'monitoring',
    name: 'New Relic',
    description: 'Observability platform for modern software',
    icon: '📈',
    rating: 4.6,
    reviews: 1543,
    downloads: '94K+',
    tags: ['monitoring', 'apm', 'observability'],
    longDescription: 'Full-stack observability platform with APM, infrastructure monitoring, and real user monitoring.',
    features: [
      'Application monitoring',
      'Infrastructure monitoring',
      'Browser monitoring',
      'Mobile monitoring',
      'Distributed tracing',
      'Custom dashboards'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'grafana',
    category: 'monitoring',
    name: 'Grafana',
    description: 'Analytics and monitoring visualization platform',
    icon: '📉',
    rating: 4.8,
    reviews: 2234,
    downloads: '145K+',
    tags: ['monitoring', 'visualization', 'analytics'],
    longDescription: 'Create, explore, and share dashboards with beautiful visualizations. Connect to multiple data sources.',
    features: [
      'Dashboard creation',
      'Data source plugins',
      'Alerting',
      'Annotations',
      'Template variables',
      'Team collaboration'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'prometheus',
    category: 'monitoring',
    name: 'Prometheus',
    description: 'Metrics monitoring and alerting toolkit',
    icon: '🔥',
    rating: 4.7,
    reviews: 1765,
    downloads: '87K+',
    tags: ['monitoring', 'metrics', 'time-series'],
    longDescription: 'Time-series database and monitoring system with powerful query language and built-in alerting.',
    features: [
      'Metric collection',
      'PromQL queries',
      'Service discovery',
      'Alerting rules',
      'Data visualization',
      'Federation'
    ],
    pricing: 'Free',
    verified: true
  },
  {
    id: 'logz',
    category: 'monitoring',
    name: 'Logz.io',
    description: 'Cloud-native observability platform',
    icon: '📋',
    rating: 4.5,
    reviews: 876,
    downloads: '45K+',
    tags: ['monitoring', 'logging', 'observability'],
    longDescription: 'Unified observability platform combining log management, infrastructure monitoring, and distributed tracing.',
    features: [
      'Log analytics',
      'Infrastructure monitoring',
      'Distributed tracing',
      'Security analytics',
      'Cloud SIEM',
      'AI-powered insights'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'figma',
    category: 'design',
    name: 'Figma',
    description: 'Collaborative design and prototyping tool',
    icon: '🎨',
    rating: 4.9,
    reviews: 3456,
    downloads: '234K+',
    tags: ['design', 'collaboration', 'prototyping'],
    longDescription: 'Design, prototype, and collaborate in real-time. Export assets and design tokens directly to code.',
    features: [
      'Design collaboration',
      'Prototyping',
      'Component libraries',
      'Design systems',
      'Code export',
      'Version history'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'jira',
    category: 'project-management',
    name: 'Jira',
    description: 'Project and issue tracking for teams',
    icon: '📋',
    rating: 4.5,
    reviews: 2987,
    downloads: '187K+',
    tags: ['project-management', 'agile', 'tracking'],
    longDescription: 'Plan, track, and manage agile software development. Scrum and Kanban boards with customizable workflows.',
    features: [
      'Issue tracking',
      'Scrum boards',
      'Kanban boards',
      'Sprint planning',
      'Custom workflows',
      'Reporting'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'trello',
    category: 'project-management',
    name: 'Trello',
    description: 'Visual collaboration and project boards',
    icon: '📊',
    rating: 4.6,
    reviews: 2543,
    downloads: '156K+',
    tags: ['project-management', 'kanban', 'collaboration'],
    longDescription: 'Organize projects with boards, lists, and cards. Simple and visual project management for teams.',
    features: [
      'Kanban boards',
      'Card management',
      'Power-ups',
      'Automation',
      'Team collaboration',
      'Mobile apps'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'asana',
    category: 'project-management',
    name: 'Asana',
    description: 'Work management platform for teams',
    icon: '✅',
    rating: 4.7,
    reviews: 2134,
    downloads: '143K+',
    tags: ['project-management', 'tasks', 'collaboration'],
    longDescription: 'Organize and plan work with projects, tasks, and timelines. Track progress and collaborate with your team.',
    features: [
      'Task management',
      'Timeline view',
      'Portfolios',
      'Workload management',
      'Automation rules',
      'Integrations'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'notion',
    category: 'productivity',
    name: 'Notion',
    description: 'All-in-one workspace for notes and docs',
    icon: '📝',
    rating: 4.8,
    reviews: 3987,
    downloads: '267K+',
    tags: ['productivity', 'documentation', 'collaboration'],
    longDescription: 'Write, plan, and get organized in one place. Notion is your all-in-one workspace for notes, docs, and wikis.',
    features: [
      'Documents',
      'Databases',
      'Wikis',
      'Templates',
      'Collaboration',
      'API access'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'linear',
    category: 'project-management',
    name: 'Linear',
    description: 'Streamlined issue tracking for software teams',
    icon: '⚡',
    rating: 4.9,
    reviews: 1876,
    downloads: '92K+',
    tags: ['project-management', 'issue-tracking', 'development'],
    longDescription: 'Purpose-built issue tracker for software teams. Fast, keyboard-first, and beautifully designed.',
    features: [
      'Issue tracking',
      'Roadmaps',
      'Cycles',
      'Git integration',
      'Keyboard shortcuts',
      'Slack integration'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'auth0',
    category: 'authentication',
    name: 'Auth0',
    description: 'Authentication and authorization platform',
    icon: '🔐',
    rating: 4.7,
    reviews: 2345,
    downloads: '156K+',
    tags: ['authentication', 'security', 'identity'],
    longDescription: 'Add authentication and authorization to your applications. Support for social logins, SSO, and MFA.',
    features: [
      'Social authentication',
      'Single sign-on',
      'Multi-factor auth',
      'User management',
      'Role-based access',
      'Identity providers'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'firebase',
    category: 'backend',
    name: 'Firebase',
    description: 'Google\'s app development platform',
    icon: '🔥',
    rating: 4.8,
    reviews: 3456,
    downloads: '245K+',
    tags: ['backend', 'database', 'realtime'],
    longDescription: 'Complete app development platform with authentication, database, storage, hosting, and analytics.',
    features: [
      'Realtime database',
      'Authentication',
      'Cloud storage',
      'Hosting',
      'Cloud functions',
      'Analytics'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'contentful',
    category: 'cms',
    name: 'Contentful',
    description: 'API-first content management platform',
    icon: '📰',
    rating: 4.6,
    reviews: 1543,
    downloads: '87K+',
    tags: ['cms', 'content', 'headless'],
    longDescription: 'Headless CMS for creating, managing, and delivering content to any platform via APIs.',
    features: [
      'Content modeling',
      'API delivery',
      'Rich text editor',
      'Media management',
      'Localization',
      'Webhooks'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'sanity',
    category: 'cms',
    name: 'Sanity',
    description: 'Platform for structured content',
    icon: '✨',
    rating: 4.8,
    reviews: 1234,
    downloads: '76K+',
    tags: ['cms', 'content', 'headless'],
    longDescription: 'Unified content platform with real-time collaboration and customizable editing environment.',
    features: [
      'Real-time editing',
      'Custom schemas',
      'GROQ queries',
      'Image pipeline',
      'Collaborative editing',
      'Version control'
    ],
    pricing: 'Freemium',
    verified: true
  },
  {
    id: 'algolia',
    category: 'search',
    name: 'Algolia',
    description: 'Fast and relevant search API',
    icon: '🔎',
    rating: 4.7,
    reviews: 1876,
    downloads: '123K+',
    tags: ['search', 'api', 'performance'],
    longDescription: 'Powerful search API with typo-tolerance, faceting, and instant results. Build delightful search experiences.',
    features: [
      'Instant search',
      'Typo tolerance',
      'Faceted search',
      'Geo search',
      'Analytics',
      'AI-powered ranking'
    ],
    pricing: 'Freemium',
    verified: true
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All Integrations' },
  { id: 'version-control', label: 'Version Control' },
  { id: 'ai-coding', label: 'AI & Coding' },
  { id: 'devops', label: 'DevOps' },
  { id: 'database', label: 'Databases' },
  { id: 'payments', label: 'Payments' },
  { id: 'communication', label: 'Communication' },
  { id: 'cloud', label: 'Cloud Platforms' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'package-management', label: 'Packages' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'design', label: 'Design' },
  { id: 'project-management', label: 'Project Management' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'backend', label: 'Backend' },
  { id: 'cms', label: 'CMS' },
  { id: 'search', label: 'Search' }
];

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIntegration, setSelectedIntegration] = React.useState<typeof INTEGRATIONS_DATA[0] | null>(null);
  const [sortBy, setSortBy] = React.useState<'rating' | 'downloads' | 'newest'>('rating');

  const filteredIntegrations = React.useMemo(() => {
    let filtered = INTEGRATIONS_DATA;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.name.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query) ||
        i.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'downloads') {
        const aNum = parseInt(a.downloads);
        const bNum = parseInt(b.downloads);
        return bNum - aNum;
      }
      return 0;
    });
  }, [selectedCategory, searchQuery, sortBy]);

  const featuredIntegrations = INTEGRATIONS_DATA.filter(i => i.featured);

  if (selectedIntegration) {
    return (
      <div className="h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-cyan-950/20 flex flex-col">
        <header className="h-12 border-b border-cyan-500/30 flex items-center px-4 bg-black/40 backdrop-blur-sm">
          <Button
            onClick={() => setSelectedIntegration(null)}
            variant="ghost"
            className="text-cyan-400 hover:text-cyan-300 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </header>
        <div className="flex-1 overflow-auto">
          <IntegrationDetail integration={selectedIntegration} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-cyan-950/20 flex flex-col">
      <header className="h-12 border-b border-cyan-500/30 flex items-center px-4 bg-black/40 backdrop-blur-sm justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="text-cyan-400 hover:text-cyan-300 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Editor
          </Button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Integrations & Plugins
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                type="text"
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-900/50 border-cyan-500/30 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Featured Section */}
          {selectedCategory === 'all' && searchQuery === '' && (
            <div className="mb-12">
              <h2 className="text-xl font-bold text-cyan-400 mb-4 font-mono">⭐ Featured Integrations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredIntegrations.slice(0, 4).map(integration => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onClick={() => setSelectedIntegration(integration)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Categories and Sorting */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-cyan-400 font-mono">Browse Integrations</h2>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-1 text-sm text-white"
                >
                  <option value="rating">Sort by: Rating</option>
                  <option value="downloads">Sort by: Downloads</option>
                  <option value="newest">Sort by: Newest</option>
                </select>
              </div>

              <Tabs
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 w-full bg-transparent mb-6 h-auto p-0">
                  {CATEGORIES.map(category => (
                    <TabsTrigger
                      key={category.id}
                      value={category.id}
                      className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border data-[state=active]:border-cyan-500/50"
                    >
                      {category.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {CATEGORIES.map(category => (
                  <TabsContent key={category.id} value={category.id}>
                    {filteredIntegrations.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredIntegrations.map(integration => (
                          <IntegrationCard
                            key={integration.id}
                            integration={integration}
                            onClick={() => setSelectedIntegration(integration)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-400">No integrations found matching your search.</p>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
