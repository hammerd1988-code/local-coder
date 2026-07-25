import * as React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Star, Download, Check, Copy, AlertCircle } from 'lucide-react';

interface IntegrationDetailProps {
  integration: any;
}

export default function IntegrationDetail({ integration }: IntegrationDetailProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyCommand = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const installCommand = `npm install @integration/${integration.id}`;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-start gap-6 mb-6">
          <div className="text-6xl">{integration.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{integration.name}</h1>
              {integration.verified && (
                <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/50 h-fit">
                  <Check className="w-3 h-3 mr-1" />
                  Official
                </Badge>
              )}
            </div>
            <p className="text-gray-400 text-lg mb-4">{integration.description}</p>

            {/* Stats */}
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span className="font-bold text-white">{integration.rating}</span>
                </div>
                <p className="text-xs text-gray-500">{integration.reviews} reviews</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white">{integration.downloads}</span>
                </div>
                <p className="text-xs text-gray-500">Downloads</p>
              </div>
              <div>
                <div className="font-bold text-cyan-400 mb-1">{integration.pricing}</div>
                <p className="text-xs text-gray-500">Pricing</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Installation Section */}
      <Card className="bg-gray-900/50 border-cyan-500/20 p-6 mb-8">
        <h2 className="text-lg font-bold text-cyan-400 mb-4 font-mono">Installation</h2>
        <div className="bg-black/50 rounded p-4 border border-gray-700 flex items-center justify-between group">
          <code className="text-sm text-green-400 font-mono">{installCommand}</code>
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopyCommand}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        {copied && <p className="text-green-400 text-xs mt-2">Copied to clipboard!</p>}
      </Card>

      {/* Description and Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card className="bg-gray-900/50 border-cyan-500/20 p-6">
          <h3 className="text-lg font-bold text-cyan-400 mb-3 font-mono">About</h3>
          <p className="text-gray-300 leading-relaxed">{integration.longDescription}</p>
        </Card>

        <Card className="bg-gray-900/50 border-cyan-500/20 p-6">
          <h3 className="text-lg font-bold text-cyan-400 mb-3 font-mono">Features</h3>
          <ul className="space-y-2">
            {integration.features.map((feature: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-gray-300">
                <Check className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Tags */}
      <Card className="bg-gray-900/50 border-cyan-500/20 p-6 mb-8">
        <h3 className="text-lg font-bold text-cyan-400 mb-3 font-mono">Categories</h3>
        <div className="flex flex-wrap gap-2">
          {integration.tags.map((tag: string) => (
            <Badge
              key={tag}
              className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Support Info */}
      <Card className="bg-gray-900/50 border-cyan-500/20 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-cyan-400 mt-1" />
          <div>
            <h3 className="font-bold text-white mb-1">Need Help?</h3>
            <p className="text-sm text-gray-400">
              Check out the official {integration.name} documentation or visit our community forums for support and integration guides.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                Documentation
              </Button>
              <Button variant="outline" size="sm" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                Community
              </Button>
              <Button variant="outline" size="sm" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                Issues
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Install Button */}
      <div className="mt-8">
        <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-base py-6">
          Install {integration.name}
        </Button>
      </div>
    </div>
  );
}
