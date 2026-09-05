import { SearchOutlined } from '@ant-design/icons'
import { Input } from 'antd'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  allowClear?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  allowClear = true,
}: SearchInputProps) {
  return (
    <Input
      allowClear={allowClear}
      className={className}
      placeholder={placeholder}
      prefix={<SearchOutlined className="text-slate-400" />}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
