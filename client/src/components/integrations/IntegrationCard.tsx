import * as React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Star, Download, Check } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  rating: number;
  reviews: number;
  downloads: string;
  tags: string[];
  verified?: boolean;
}

interface IntegrationCardProps {
  integration: Integration;
  onClick: () => void;
}

export default function IntegrationCard({ integration, onClick }: IntegrationCardProps) {
  return (
    <Card
      onClick={onClick}
      className="bg-gray-900/50 border-cyan-500/20 hover:border-cyan-500/50 hover:bg-gray-900/80 transition-all cursor-pointer overflow-hidden group"
    >
      <div className="p-4 h-full flex flex-col">
        {/* Header with Icon and Verified Badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="text-3xl">{integration.icon}</div>
          {integration.verified && (
            <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/50">
              <Check className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>

        {/* Title and Description */}
        <h3 className="font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{integration.name}</h3>
        <p className="text-xs text-gray-400 mb-4 line-clamp-2">{integration.description}</p>

        {/* Rating and Downloads */}
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
            <span className="text-white font-semibold">{integration.rating}</span>
            <span className="text-gray-500">({integration.reviews})</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Download className="w-3 h-3" />
            <span>{integration.downloads}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {integration.tags.slice(0, 2).map(tag => (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
            >
              {tag}
            </Badge>
          ))}
          {integration.tags.length > 2 && (
            <Badge variant="outline" className="text-xs bg-gray-800/50 text-gray-400 border-gray-700">
              +{integration.tags.length - 2}
            </Badge>
          )}
        </div>

        {/* View Details Button */}
        <Button
          className="w-full mt-auto bg-cyan-600 hover:bg-cyan-700 text-white text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View Details
        </Button>
      </div>
    </Card>
  );
}
