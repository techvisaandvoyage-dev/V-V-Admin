import sys

file_path = 'admin/src/pages/Dashboard.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
target_idx = -1

for i, line in enumerate(lines):
    if '{/* TAB 3: COUNTRY MANAGER' in line:
        start_idx = i - 1  # include the comment
    if '{/* TAB 4: CONTROLS' in line:
        end_idx = i - 1  # right before the next tab comment
    if '{/* Dynamic Content Panel rendering' in line:
        target_idx = i + 1

if start_idx != -1 and end_idx != -1 and target_idx != -1:
    print(f'Found block from {start_idx} to {end_idx}, moving to {target_idx}')
    
    # Extract the block
    block = lines[start_idx:end_idx]
    
    # Modify the wrapper
    for i, line in enumerate(block):
        if 'activeTab === "countries" && (' in line:
            block[i] = '          <div className={activeControlGroupKey === "countries" ? "w-full max-w-none flex-1 self-stretch" : "hidden"}>\n'
        elif '          )}' in line and i == len(block) - 2:
            block[i] = '          </div>\n'
    
    # Remove from original location
    del lines[start_idx:end_idx]
    
    # Recalculate target index because lines were deleted above it
    if target_idx > end_idx:
        target_idx -= (end_idx - start_idx)
        
    # Find a good place to insert, let's say right after the SupportChatWorkspace div
    insert_idx = -1
    for i, line in enumerate(lines):
        if '<SupportChatWorkspace />' in line:
            insert_idx = i + 3
            break
            
    if insert_idx != -1:
        lines.insert(insert_idx, ''.join(block))
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print('Successfully moved the Country Manager block!')
    else:
        print('Could not find insert index!')
else:
    print('Could not find indices!', start_idx, end_idx, target_idx)
