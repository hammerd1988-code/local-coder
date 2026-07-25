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
    icon: '☁️',
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
    id: 'heroku',
    category: 'deployment',
    name: 'Heroku',
    description: 'Cloud application platform and hosting',
    icon: '🦶',
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
  { id: 'monitoring', label: 'Monitoring' }
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
                <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 w-full bg-transparent mb-6 h-auto p-0">
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
