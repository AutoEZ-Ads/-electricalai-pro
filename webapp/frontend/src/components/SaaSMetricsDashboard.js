import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Users, DollarSign, Target, Zap, Award } from 'lucide-react';

const SaaSMetricsDashboard = () => {
  const [timeRange, setTimeRange] = useState('6months');

  // Sample data for demonstration
  const mrrData = [
    { month: 'Jan', mrr: 45000, customers: 90 },
    { month: 'Feb', mrr: 67000, customers: 134 },
    { month: 'Mar', mrr: 89000, customers: 178 },
    { month: 'Apr', mrr: 123000, customers: 246 },
    { month: 'May', mrr: 156000, customers: 312 },
    { month: 'Jun', mrr: 201000, customers: 402 }
  ];

  const cohortData = [
    { month: 'Month 1', retention: 100 },
    { month: 'Month 2', retention: 94 },
    { month: 'Month 3', retention: 89 },
    { month: 'Month 6', retention: 82 },
    { month: 'Month 12', retention: 76 }
  ];

  const unitEconomics = {
    ltv: 8420,
    cac: 312,
    ltvCacRatio: 27.0,
    paybackPeriod: 2.1,
    grossMargin: 87
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ElectricalAI Pro - SaaS Metrics</h1>
          <p className="text-gray-600">Series A Investment Dashboard</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-gray-900">$201K</p>
                <p className="text-sm text-green-600">+29% MoM</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Customers</p>
                <p className="text-2xl font-bold text-gray-900">402</p>
                <p className="text-sm text-green-600">+28% MoM</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">LTV:CAC Ratio</p>
                <p className="text-2xl font-bold text-gray-900">27.0x</p>
                <p className="text-sm text-green-600">Industry: 3-5x</p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Revenue Retention</p>
                <p className="text-2xl font-bold text-gray-900">142%</p>
                <p className="text-sm text-green-600">Best-in-class</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Recurring Revenue Growth</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mrrData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value.toLocaleString()}`, 'MRR']} />
                <Line type="monotone" dataKey="mrr" stroke="#3B82F6" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Retention Cohort</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cohortData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Retention']} />
                <Bar dataKey="retention" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Unit Economics */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Unit Economics</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Customer LTV</p>
              <p className="text-2xl font-bold text-gray-900">${unitEconomics.ltv.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Customer CAC</p>
              <p className="text-2xl font-bold text-gray-900">${unitEconomics.cac}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">LTV:CAC Ratio</p>
              <p className="text-2xl font-bold text-green-600">{unitEconomics.ltvCacRatio}x</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Payback Period</p>
              <p className="text-2xl font-bold text-gray-900">{unitEconomics.paybackPeriod} months</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Gross Margin</p>
              <p className="text-2xl font-bold text-gray-900">{unitEconomics.grossMargin}%</p>
            </div>
          </div>
        </div>

        {/* Investment Highlights */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
          <h3 className="text-2xl font-bold mb-6 flex items-center">
            <Award className="mr-3" />
            Series A Investment Highlights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-2">🚀 Exceptional Growth</h4>
              <ul className="text-sm space-y-1 opacity-90">
                <li>• 347% YoY Revenue Growth</li>
                <li>• 28% Monthly Customer Growth</li>
                <li>• $2.4M ARR Run Rate</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">💰 Superior Unit Economics</h4>
              <ul className="text-sm space-y-1 opacity-90">
                <li>• 27x LTV:CAC (vs 3-5x industry)</li>
                <li>• 87% Gross Margins</li>
                <li>• 2.1 month payback period</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🏆 Market Position</h4>
              <ul className="text-sm space-y-1 opacity-90">
                <li>• First AI-powered electrical platform</li>
                <li>• 94% estimation accuracy</li>
                <li>• $174B addressable market</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaaSMetricsDashboard;