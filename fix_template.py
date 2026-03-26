#!/usr/bin/env python3
"""
Script to update Global Performance table in template_atria.ejs
to make it dynamic based on enabledChannels
"""

import re

# Read the template file
with open('execution/templates/template_atria.ejs', 'r') as f:
    content = f.read()

# Define the old static table section (Page 7)
old_section = r'''        <div class="table-container" style="padding: 0 20mm;">
            <table class="performance-table">
                <thead>
                    <tr>
                        <th style="width: 25%">Metriks</th>
                        <th style="width: 15%">SHOPEE</th>
                        <th style="width: 20%">THIS MONTH</th>
                        <th style="width: 20%">LAST MONTH</th>
                        <th style="width: 20%">GROWTH</th>
                    </tr>
                </thead>
                <tbody>
                    <% globalPerformanceDetail\.comparisonData\.forEach\(row=> \{ %>
                        <tr>
                            <td class="metric-col">
                                <div class="truncate">
                                    <%= row\.metric %>
                                </div>
                            </td>
                            <td>
                                <%= row\.channels\?\.shopee \|\| '-' %>
                            </td>
                            <td>
                                <%= row\.thisMonth %>
                            </td>
                            <td>
                                <%= row\.lastMonth %>
                            </td>
                            <td
                                style="color: <%= row\.growth\.includes\('\+'\) \? 'var\(--success-green\)' : 'var\(--error-red\)' %>; font-weight: 700;">
                                <%= row\.growth %>
                            </td>
                        </tr>
                        <% \}\) %>
                </tbody>
            </table>
        </div>'''

# Define the new dynamic table section
new_section = '''        <div class="table-container" style="padding: 0 20mm;">
            <%
            // Build list of enabled channels in order
            const channelOrder = ['shopee', 'tiktok', 'tokopedia', 'lazada', 'blibli'];
            const enabledChannelsList = channelOrder.filter(ch => enabledChannels[ch]);
            const channelCount = enabledChannelsList.length;
            
            // Calculate dynamic column widths
            const metricWidth = 25; // Fixed for Metriks column
            const fixedColsWidth = 60; // THIS MONTH (20%) + LAST MONTH (20%) + GROWTH (20%)
            const availableWidth = 100 - metricWidth - fixedColsWidth;
            const channelColWidth = channelCount > 0 ? (availableWidth / channelCount).toFixed(1) : 0;
            %>
            <table class="performance-table">
                <thead>
                    <tr>
                        <th style="width: <%= metricWidth %>%">Metriks</th>
                        <% enabledChannelsList.forEach(channel => { %>
                            <th style="width: <%= channelColWidth %>%"><%= channel.toUpperCase() %></th>
                        <% }) %>
                        <th style="width: 20%">THIS MONTH</th>
                        <th style="width: 20%">LAST MONTH</th>
                        <th style="width: 20%">GROWTH</th>
                    </tr>
                </thead>
                <tbody>
                    <% globalPerformanceDetail.comparisonData.forEach(row => { %>
                        <tr>
                            <td class="metric-col">
                                <div class="truncate">
                                    <%= row.metric %>
                                </div>
                            </td>
                            <% enabledChannelsList.forEach(channel => { %>
                                <td>
                                    <%= row.channels?.[channel] || '-' %>
                                </td>
                            <% }) %>
                            <td>
                                <%= row.thisMonth %>
                            </td>
                            <td>
                                <%= row.lastMonth %>
                            </td>
                            <td
                                style="color: <%= row.growth.includes('+') ? 'var(--success-green)' : 'var(--error-red)' %>; font-weight: 700;">
                                <%= row.growth %>
                            </td>
                        </tr>
                        <% }) %>
                </tbody>
            </table>
        </div>'''

# Replace the section
new_content = re.sub(old_section, new_section, content, flags=re.DOTALL)

# Write back
with open('execution/templates/template_atria.ejs', 'w') as f:
    f.write(new_content)

print("✅ Successfully updated Global Performance table to be dynamic!")
