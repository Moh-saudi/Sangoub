const fs = require('fs');

const path = 'd:/Sangoub/src/components/BulkProductImportModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states after errorMessage
const target = `  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);`;

const replacement = `  const [errorMessage, setErrorMessage] = useState('');
  const [filterOnlyErrors, setFilterOnlyErrors] = useState(false);
  const [importResult, setImportResult] = useState<{
    completed: boolean;
    successCount: number;
    failedCount: number;
    errors: ImportErrorItem[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);`;

content = content.replace(target, replacement);

// 2. Fix typing in handleExportErrorRows: err: ImportErrorItem
content = content.replace(
  'const errorData = importResult.errors.map(err => ({',
  'const errorData = importResult.errors.map((err: ImportErrorItem) => ({'
);

// 3. Fix typing in JSX error table map: (err: ImportErrorItem, i: number)
content = content.replace(
  '{importResult.errors.map((err, i) => (',
  '{importResult.errors.map((err: ImportErrorItem, i: number) => ('
);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully declared importResult state and fixed typings');

